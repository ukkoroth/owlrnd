/**
 * Live check of the Claude calls (needs ANTHROPIC_API_KEY): npm run ai:smoke
 * Sends a description and a sample textbook page through the track chat, agrees a goal, then writes a first exam.
 * Prints everything for a human to read, fails on any schema or validation error, and records the raw outputs to
 * tests/fixtures-files/ai-samples/ for the schema test.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { readFileSync, writeFileSync } from "node:fs";
import { firstExamPlan, validateWrittenExam } from "@/domain/examPlan";
import { canCreateTrack, emptyPreview, sanitizePreview, todayIn } from "@/domain/tracks";
import { trackChat } from "@/server/ai/trackChat";
import { writeQuestions } from "@/server/ai/writeQuestions";
import { markAnswers } from "@/server/ai/markAnswers";
import { trackUpdateChat } from "@/server/ai/trackUpdate";
import { canApplyUpdate, emptyUpdate, sanitizeUpdate } from "@/domain/tracks";

const out = "tests/fixtures-files/ai-samples";
const today = todayIn("Asia/Kolkata");
const page = readFileSync("tests/fixtures-files/sample-textbook-page.png");
const base = { parentName: "Atticus", studentName: "Scout", className: "Class 10", today, mode: "first" as const };

async function main() {
  const t0 = Date.now();
  const message1 = "Physics unit test next Friday. Chapter 12: Ohm's law, resistors in series and in parallel. Page attached.";
  const turn1 = await trackChat({ ...base, preview: emptyPreview, history: [], attachments: [{ kind: "new", label: "page-142.png", mediaType: "image/png", data: page }], message: message1 });
  writeFileSync(`${out}/trackChat-turn1.json`, JSON.stringify(turn1, null, 2));
  console.log(`\n── Turn 1 (${((Date.now() - t0) / 1000).toFixed(1)} s) ──\nAI: ${turn1.reply}\nExtracted: ${turn1.extracted.map((e) => `${e.label} readable=${e.readable} chars=${e.text.length}`).join("; ")}`);
  const p1 = sanitizePreview(turn1.preview, today);
  console.log("Preview:", JSON.stringify(p1, null, 2), "ready:", turn1.ready);

  const t1 = Date.now();
  const message2 = "Yes, and more calculations on parallel circuits. Make the goal 9 / 10 in 3 exams in a row. No test date needed.";
  const turn2 = await trackChat({
    ...base,
    preview: p1,
    history: [
      { author: "parent", text: message1 },
      { author: "ai", text: turn1.reply },
    ],
    attachments: [{ kind: "earlier", label: turn1.extracted[0]?.label ?? "page", text: turn1.extracted[0]?.text ?? "", unreadable: false }],
    message: message2,
  });
  writeFileSync(`${out}/trackChat-turn2.json`, JSON.stringify(turn2, null, 2));
  const p2 = sanitizePreview(turn2.preview, today);
  console.log(`\n── Turn 2 (${((Date.now() - t1) / 1000).toFixed(1)} s) ──\nAI: ${turn2.reply}\nPreview:`, JSON.stringify(p2, null, 2), "ready:", turn2.ready);
  if (!canCreateTrack(p2)) throw new Error("Preview after turn 2 is not complete enough to create a track.");
  if (p2.goal?.threshold !== 9 || p2.goal?.runLength !== 3) throw new Error("The goal change was not applied.");

  const t2 = Date.now();
  const topics = p2.topics.map((t, i) => ({ key: `T${i + 1}`, ...t }));
  const plan = firstExamPlan(topics.map((t) => t.key));
  const questions = await writeQuestions({
    trackName: p2.name!,
    className: base.className,
    topics,
    focusNotes: p2.focusNotes,
    material: `Parent: ${message1}\nParent: ${message2}\n\n[${turn1.extracted[0]?.label}]\n${turn1.extracted[0]?.text}`,
    plan,
    avoid: [],
  });
  writeFileSync(`${out}/writeQuestions.json`, JSON.stringify({ questions }, null, 2));
  console.log(`\n── First exam (${((Date.now() - t2) / 1000).toFixed(1)} s) ──`);
  questions.forEach((q, i) => {
    const topic = topics.find((t) => t.key === q.topicKey)?.name;
    console.log(`\n${i + 1}. [${topic} · ${q.type} · difficulty ${q.difficulty}] ${q.prompt}`);
    if (q.type === "multiple_choice") q.options.forEach((o, j) => console.log(`   ${"ABCD"[j]}. ${o}${j === q.correctIndex ? "   ✓" : ""}`));
    else console.log(`   Expected: ${q.expectedAnswer}`);
    console.log(`   Why: ${q.explanation}`);
  });
  const errors = validateWrittenExam(plan, questions);
  if (errors.length) throw new Error(errors.join("\n"));

  // Short-answer marking (AI §4): right, misspelled, equivalent wording, wrong, wrong unit.
  const t3 = Date.now();
  const cases = [
    { key: "A1", question: "A current of 0.5 A flows through a 20 Ω resistor. What is the potential difference across it?", expected: "10 V", given: "10 volts", want: true },
    { key: "A2", question: "Which law states that the current through a conductor is proportional to the voltage across it?", expected: "Ohm's law", given: "Ohms lw", want: true },
    { key: "A3", question: "Why are household appliances connected in parallel?", expected: "So each appliance gets the full supply voltage and can be switched on or off on its own.", given: "because then every appliance gets 220 V and you can switch them separately", want: true },
    { key: "A4", question: "Resistors of 4 Ω and 12 Ω are joined in parallel. What is the equivalent resistance?", expected: "3 Ω", given: "16 Ω", want: false },
    { key: "A5", question: "A potential difference of 9 V is applied across a 45 Ω resistor. What current flows?", expected: "0.2 A", given: "0.2 V", want: false },
  ];
  const marked = await markAnswers(cases);
  writeFileSync(`${out}/markAnswers.json`, JSON.stringify({ results: marked }, null, 2));
  console.log(`\n── Marking short answers (${((Date.now() - t3) / 1000).toFixed(1)} s) ──`);
  let disagreements = 0;
  for (const c of cases) {
    const m = marked.find((x) => x.key === c.key)!;
    const ok = m.correct === c.want;
    if (!ok) disagreements++;
    console.log(`${ok ? "✓" : "✗ UNEXPECTED"} "${c.given}" (expected "${c.expected}") → ${m.correct ? "right" : `wrong: ${m.reason}`}`);
  }
  if (disagreements) throw new Error(`${disagreements} marking result(s) differ from what a teacher would give.`);

  // Restarting the track after its goal (2j): a new chapter page, then the parent agrees.
  const t4 = Date.now();
  const page13 = readFileSync("tests/fixtures-files/sample-textbook-page-13.png");
  const trackNow = {
    name: p2.name!,
    topics: p2.topics.map((t) => ({ name: t.name, strength: "strong" })),
    goal: p2.goal!,
    goalProgress: 3,
    goalReachedOn: "28 Nov",
  };
  const r1 = await trackUpdateChat({
    mode: "restart", parentName: "Atticus", studentName: "Scout", className: "Class 10", today, track: trackNow, update: emptyUpdate, history: [],
    attachments: [{ kind: "new", label: "page-158.png", mediaType: "image/png", data: page13 }],
    message: "Add chapter 13, magnetic effects of current. Keep some revision of chapter 12.",
  });
  writeFileSync(`${out}/trackUpdate-turn1.json`, JSON.stringify(r1, null, 2));
  const u1 = sanitizeUpdate(r1.update, trackNow.topics.map((t) => t.name), today);
  console.log(`\n── Restart, turn 1 (${((Date.now() - t4) / 1000).toFixed(1)} s) ──\nAI: ${r1.reply}\nNew topics: ${u1.newTopics.map((t) => t.name).join(", ")}\nGoal: ${JSON.stringify(u1.goal)} ready: ${r1.ready}`);
  const r2 = await trackUpdateChat({
    mode: "restart", parentName: "Atticus", studentName: "Scout", className: "Class 10", today, track: trackNow, update: u1,
    history: [
      { author: "parent", text: "Add chapter 13, magnetic effects of current. Keep some revision of chapter 12." },
      { author: "ai", text: r1.reply },
    ],
    attachments: [{ kind: "earlier", label: r1.extracted[0]?.label ?? "page", text: r1.extracted[0]?.text ?? "", unreadable: false }],
    message: "Yes, start it.",
  });
  writeFileSync(`${out}/trackUpdate-turn2.json`, JSON.stringify(r2, null, 2));
  const u2 = sanitizeUpdate(r2.update, trackNow.topics.map((t) => t.name), today);
  console.log(`\n── Restart, turn 2 ──\nAI: ${r2.reply}\nready: ${r2.ready}`);
  if (!r2.ready || !canApplyUpdate("restart", u2)) throw new Error("The restart was not agreed after the parent said yes.");
  if (!u2.newTopics.length) throw new Error("No new topics found on the chapter 13 page.");
  console.log(`\nAll checks passed in ${((Date.now() - t0) / 1000).toFixed(1)} s. Samples saved to ${out}/.`);
}

main().catch((err) => {
  console.error("\nai:smoke FAILED:", err);
  process.exit(1);
});
