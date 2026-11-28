/**
 * Live check of the picture writer (docs/07-ai.md §8; needs ANTHROPIC_API_KEY):
 *   npm run ai:visuals -- <items.json> [out.json]
 * items.json: [{ prompt, options, answer, explanation }]. Prints which items got a picture, the time and the cost
 * (recorded in the local ai_usage table), and writes the scenes to out.json (default tmp/visuals-smoke.json), which
 * /dev/visuals shows below the samples.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { readFileSync, writeFileSync } from "node:fs";
import { desc, eq } from "drizzle-orm";

type In = { prompt: string; options: string[]; answer: string; explanation: string };

async function main() {
  // Loaded after the environment file (static imports would run first).
  const { drawVisuals } = await import("@/server/ai/drawVisuals");
  const { withAiContext } = await import("@/server/ai/usage");
  const { db } = await import("@/server/db");
  const { aiUsage } = await import("@/server/db/schema");
  const [file, outFile = "tmp/visuals-smoke.json"] = process.argv.slice(2);
  if (!file) throw new Error("usage: npm run ai:visuals -- <items.json> [out.json]");
  const items: In[] = JSON.parse(readFileSync(file, "utf8"));
  const t0 = Date.now();
  const drawn = await withAiContext({ purpose: "draw_visuals", holder: null }, () =>
    drawVisuals({
      audience: "parent",
      trackName: process.env.TRACK_NAME ?? "Physics: Light energy",
      level: process.env.TRACK_LEVEL ?? "Class 10",
      items: items.map((it, i) => ({ key: `Q${i + 1}`, kind: "question" as const, ...it })),
    }),
  );
  const secs = (Date.now() - t0) / 1000;
  const since = new Date(t0 - 1000);
  const rows = (await db.select().from(aiUsage).where(eq(aiUsage.purpose, "draw_visuals")).orderBy(desc(aiUsage.createdAt)).limit(5)).filter((r) => r.createdAt >= since);
  const out = items.map((it, i) => ({ prompt: it.prompt, answer: it.answer, scene: drawn.get(`Q${i + 1}`) ?? null }));
  writeFileSync(outFile, JSON.stringify(out, null, 1));
  for (const [i, o] of out.entries()) console.log(`${o.scene ? "PICTURE" : "none   "}  Q${i + 1}  ${o.prompt.slice(0, 90)}`);
  console.log(`\n${out.filter((o) => o.scene).length} of ${out.length} got a picture in ${secs.toFixed(1)} s, ${rows.length} call(s)`);
  for (const r of rows) console.log(`  ${r.model}: ${r.inputTokens} in, ${r.outputTokens} out, $${Number(r.costUsd).toFixed(4)}`);
  console.log(`  total $${rows.reduce((s, r) => s + Number(r.costUsd), 0).toFixed(4)}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
