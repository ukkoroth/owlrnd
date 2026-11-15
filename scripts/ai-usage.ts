/**
 * Claude spend this month (UTC): npm run ai:usage
 * Totals by purpose, the families that used the most, and how much of AI_MONTHLY_BUDGET_USD is left.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

const { count, desc, eq, gte, sql, sum } = await import("drizzle-orm");
const { db } = await import("@/server/db");
const { aiUsage, parents } = await import("@/server/db/schema");
const { env } = await import("@/server/env");

async function main() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const budget = env().AI_MONTHLY_BUDGET_USD;
  const usd = (n: unknown) => `$${Number(n ?? 0).toFixed(2)}`;

  const byPurpose = await db
    .select({ purpose: aiUsage.purpose, calls: count(), cost: sum(aiUsage.costUsd), output: sum(aiUsage.outputTokens) })
    .from(aiUsage)
    .where(gte(aiUsage.createdAt, start))
    .groupBy(aiUsage.purpose)
    .orderBy(desc(sum(aiUsage.costUsd)));
  const total = byPurpose.reduce((t, r) => t + Number(r.cost ?? 0), 0);

  console.log(`Claude spend for ${start.toISOString().slice(0, 7)}: ${usd(total)} of ${usd(budget)} (${Math.round((total / budget) * 100)}%)\n`);
  if (!byPurpose.length) return console.log("No calls recorded yet this month.");
  for (const r of byPurpose) {
    const perCall = Number(r.cost ?? 0) / r.calls;
    console.log(`  ${r.purpose.padEnd(13)} ${String(r.calls).padStart(5)} calls  ${usd(r.cost).padStart(9)}  (${usd(perCall)} a call, ${Math.round(Number(r.output) / r.calls)} output tokens)`);
  }

  const families = await db
    .select({ name: parents.name, cost: sum(aiUsage.costUsd), calls: count() })
    .from(aiUsage)
    .leftJoin(parents, eq(parents.id, aiUsage.parentId))
    .where(gte(aiUsage.createdAt, start))
    .groupBy(parents.name, aiUsage.parentId)
    .orderBy(desc(sql`sum(${aiUsage.costUsd})`))
    .limit(10);
  console.log("\nFamilies using the most:");
  for (const f of families) console.log(`  ${(f.name ?? "(deleted account)").padEnd(28)} ${usd(f.cost).padStart(9)}  ${f.calls} calls`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode ?? 0));
