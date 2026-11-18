/**
 * Live cost check for the question pool (roadmap 23; needs ANTHROPIC_API_KEY): npm run ai:measure-pool
 * Writes one exam the old way (10 questions) and one pool batch (20) from the same sample material, and prints the
 * time, tokens and cost of each from ai_usage. Costs a few tens of cents on the configured model.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { readFileSync } from "node:fs";
import type { PlanSlot } from "@/domain/examPlan";

// Loaded after the environment file (static imports would run first).
const { desc } = await import("drizzle-orm");
const { firstExamPlan, validateWrittenExam } = await import("@/domain/examPlan");
const { poolWritePlan } = await import("@/domain/questionPool");
const { writeQuestions } = await import("@/server/ai/writeQuestions");
const { withAiContext } = await import("@/server/ai/usage");
const { db } = await import("@/server/db");
const { aiUsage } = await import("@/server/db/schema");

const turn1 = JSON.parse(readFileSync("tests/fixtures-files/ai-samples/trackChat-turn1.json", "utf8")) as { extracted: { label: string; text: string }[] };
const material = [
  "Parent: Physics unit test. Chapter 12: Ohm's law, resistors in series and in parallel.",
  ...turn1.extracted.map((e) => `[${e.label}]\n${e.text}`),
].join("\n\n");
const topics = [
  { key: "T1", name: "Ohm's law", description: "V = IR, units, graphs" },
  { key: "T2", name: "Resistors in series", description: "equivalent resistance, current and voltage" },
  { key: "T3", name: "Resistors in parallel", description: "equivalent resistance, current division" },
];
const base = { audience: "parent" as const, trackName: "Physics: Electricity (Ch 12)", level: "Class 10", topics, focusNotes: null, material, avoid: [], deckFronts: [] };

async function run(label: string, bank: boolean, plan: PlanSlot[]) {
  const t0 = Date.now();
  const qs = await withAiContext({ purpose: bank ? "write_pool" : "write_exam", holder: null }, () => writeQuestions({ ...base, plan, bank }));
  const secs = (Date.now() - t0) / 1000;
  const [u] = await db.select().from(aiUsage).orderBy(desc(aiUsage.createdAt)).limit(1);
  const cost = u?.costUsd ?? 0;
  console.log(
    `${label}: ${qs.length} questions in ${secs.toFixed(1)} s · in ${u?.inputTokens} out ${u?.outputTokens} · $${cost.toFixed(4)} · $${((cost / qs.length) * 10).toFixed(4)} per 10 · problems: ${validateWrittenExam(plan, qs).length}`,
  );
  console.log("   difficulty:", qs.map((q) => q.difficulty).join(" "));
}

async function main() {
  await run("One exam (10, as today)", false, firstExamPlan(["T1", "T2", "T3"]));
  const mix = topics.map((t) => ({ key: t.key, name: t.name, strength: "not_tested" as const }));
  await run("Pool batch (20)", true, poolWritePlan(mix, [], [], 20));
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
