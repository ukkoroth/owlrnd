import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { and, count, eq, gte, lt, sql, sum } from "drizzle-orm";
import { aiPrices, CACHE_WRITE_MULTIPLIER, DEFAULT_PRICED_MODEL } from "@/config/aiPrices";
import { rules } from "@/config/rules";
import { db } from "../db";
import { aiBudgetAlerts, aiUsage, exams, parents, students, trackMessages, tracks } from "../db/schema";
import { emailSender } from "../email";
import { env } from "../env";

/**
 * AI cost controls (release plan, Phase 1 item 4): every Claude call is recorded with its estimated cost, families
 * have daily limits, and the month has a budget. Marking submitted exams is never limited.
 */

export type AiPurpose = (typeof aiUsage.$inferInsert)["purpose"];
type AiContext = { purpose: AiPurpose; parentId: string | null };
type Usage = { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null };

const context = new AsyncLocalStorage<AiContext>();

/** Runs `fn` with the purpose and family that Claude calls inside it are recorded against. */
export function withAiContext<T>(ctx: AiContext, fn: () => Promise<T>): Promise<T> {
  return context.run(ctx, fn);
}

export function costOf(model: string, u: Usage): number {
  const p = aiPrices[model] ?? aiPrices[DEFAULT_PRICED_MODEL]!;
  const cacheRead = u.cache_read_input_tokens ?? 0;
  const cacheWrite = u.cache_creation_input_tokens ?? 0;
  const dollars = u.input_tokens * p.input + cacheWrite * p.input * CACHE_WRITE_MULTIPLIER + cacheRead * p.cacheRead + u.output_tokens * p.output;
  return Math.round((dollars / 1_000_000) * 1e6) / 1e6;
}

/** Called after every Claude response (client.ts). Never throws: a failed record must not fail the user's request. */
export async function recordUsage(model: string, u: Usage) {
  const ctx = context.getStore();
  if (!ctx) {
    console.warn(`[owlrnd ai] Claude call outside withAiContext; not recorded (${model}, ${u.output_tokens} output tokens)`);
    return;
  }
  try {
    await db.insert(aiUsage).values({
      parentId: ctx.parentId,
      purpose: ctx.purpose,
      model,
      inputTokens: u.input_tokens,
      outputTokens: u.output_tokens,
      cacheReadTokens: u.cache_read_input_tokens ?? 0,
      cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
      costUsd: costOf(model, u),
    });
    await alertOwnerIfNeeded();
  } catch (err) {
    console.error("[owlrnd ai] could not record usage", err);
  }
}

// ── Monthly budget ──────────────────────────────────────────────────────────

const monthKey = (now = new Date()) => now.toISOString().slice(0, 7);
const monthStart = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

const nextMonthStart = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

export async function spendThisMonth(now = new Date()): Promise<number> {
  const [row] = await db
    .select({ total: sum(aiUsage.costUsd) })
    .from(aiUsage)
    .where(and(gte(aiUsage.createdAt, monthStart(now)), lt(aiUsage.createdAt, nextMonthStart(now))));
  return Number(row?.total ?? 0);
}

export async function budgetLeft(now = new Date()) {
  return (await spendThisMonth(now)) < env().AI_MONTHLY_BUDGET_USD;
}

export async function alertOwnerIfNeeded(now = new Date()) {
  const budget = env().AI_MONTHLY_BUDGET_USD;
  const spent = await spendThisMonth(now);
  const levels = [
    { level: "warn", at: budget * rules.aiLimits.budgetWarnAt },
    { level: "reached", at: budget },
  ].filter((l) => spent >= l.at);
  for (const { level } of levels) {
    const inserted = await db.insert(aiBudgetAlerts).values({ month: monthKey(now), level }).onConflictDoNothing().returning();
    if (!inserted.length) continue; // already sent this month
    const reached = level === "reached";
    const subject = reached
      ? `owlrnd: the AI budget for ${monthKey(now)} is used up`
      : `owlrnd: ${Math.round(rules.aiLimits.budgetWarnAt * 100)}% of this month's AI budget is used`;
    const text = [
      `Claude spend so far this month: $${spent.toFixed(2)} of $${budget.toFixed(2)}.`,
      "",
      reached
        ? "New track chats and new exams are paused until the month ends or the budget is raised. Exams already submitted are still marked."
        : "Nothing is paused yet. At 100%, new track chats and new exams pause until the month ends or the budget is raised.",
      "",
      "To raise it, change AI_MONTHLY_BUDGET_USD in the server's environment file and restart the app.",
      "To see the breakdown: npm run ai:usage",
    ].join("\n");
    const owner = env().OWNER_EMAIL;
    if (owner) await emailSender().send({ to: owner, subject, text }).catch((err) => console.error("[owlrnd ai] budget email failed", err));
    else console.warn(`[owlrnd ai] ${subject} (set OWNER_EMAIL to get this by email)`);
  }
}

// ── Daily limits per family ─────────────────────────────────────────────────

/** True when `column` falls on the family's current day, in the family's time zone. */
const familyToday = (column: typeof trackMessages.createdAt | typeof exams.createdAt) =>
  sql`(${column} at time zone ${parents.timeZone})::date = (now() at time zone ${parents.timeZone})::date`;

export async function chatTurnsToday(parentId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(trackMessages)
    .innerJoin(tracks, eq(tracks.id, trackMessages.trackId))
    .innerJoin(students, eq(students.id, tracks.studentId))
    .innerJoin(parents, eq(parents.id, students.parentId))
    .where(and(eq(parents.id, parentId), eq(trackMessages.author, "parent"), familyToday(trackMessages.createdAt)));
  return row?.n ?? 0;
}

export async function examsWrittenToday(parentId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(exams)
    .innerJoin(students, eq(students.id, exams.studentId))
    .innerJoin(parents, eq(parents.id, students.parentId))
    .where(and(eq(parents.id, parentId), familyToday(exams.createdAt)));
  return row?.n ?? 0;
}

/** The start of the family's next day, as an instant. */
async function familyNextMidnight(parentId: string): Promise<Date> {
  const [row] = await db
    .select({ at: sql<Date>`(date_trunc('day', now() at time zone ${parents.timeZone}) + interval '1 day') at time zone ${parents.timeZone}` })
    .from(parents)
    .where(eq(parents.id, parentId));
  return new Date(row?.at ?? Date.now() + 86_400_000);
}

export const CHAT_PAUSED = "The track chat is paused for a little while. Your chat is saved, so please try again later.";
export const chatLimitReached = () =>
  `You've reached today's limit of ${rules.aiLimits.chatTurnsPerDay} messages in track chats. Your chat is saved, so you can carry on tomorrow.`;

/** Before a parent's chat message goes to Claude. Null when allowed, otherwise the message to show. */
export async function chatBlocked(parentId: string): Promise<string | null> {
  if (!(await budgetLeft())) return CHAT_PAUSED;
  if ((await chatTurnsToday(parentId)) >= rules.aiLimits.chatTurnsPerDay) return chatLimitReached();
  return null;
}

/** Before an exam is written. When not allowed, says when to try again (the job is rescheduled, not failed). */
export async function examWriteBlocked(parentId: string): Promise<{ retryAt: Date; reason: "budget" | "daily_limit" } | null> {
  if (!(await budgetLeft())) return { retryAt: new Date(Date.now() + rules.aiLimits.budgetRetryMinutes * 60_000), reason: "budget" };
  if ((await examsWrittenToday(parentId)) >= rules.aiLimits.examsWrittenPerDay) return { retryAt: await familyNextMidnight(parentId), reason: "daily_limit" };
  return null;
}
