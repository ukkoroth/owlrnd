import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { and, count, eq, gte, inArray, isNull, lt, sql, sum } from "drizzle-orm";
import { aiPrices, CACHE_WRITE_MULTIPLIER, DEFAULT_PRICED_MODEL } from "@/config/aiPrices";
import { rules } from "@/config/rules";
import { allowanceState, type AllowanceState } from "@/domain/allowance";
import type { Holder, HolderRef } from "@/domain/accounts";
import { db } from "../db";
import { aiBudgetAlerts, aiUsage, exams, students, trackMessages, tracks } from "../db/schema";
import { emailSender } from "../email";
import { env } from "../env";

/**
 * AI cost controls (release plan, Phase 1 item 4; 0.2 plan, M7): every Claude call is recorded with its estimated
 * cost against the account holder (a family, or a self-managed learner). Each holder has daily limits and a demo
 * allowance, and the month has a budget. Marking submitted exams is never limited.
 */

export type AiPurpose = (typeof aiUsage.$inferInsert)["purpose"];
/** `holder` is who pays (null for calls outside any account); `studentId` the learner the call was for, if any. */
type AiContext = { purpose: AiPurpose; holder: HolderRef | null; studentId?: string | null };
type Usage = { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null };

const context = new AsyncLocalStorage<AiContext>();

/** Runs `fn` with the purpose and account holder that Claude calls inside it are recorded against. */
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
      parentId: ctx.holder && "parentId" in ctx.holder ? ctx.holder.parentId : null,
      studentId: ctx.holder && "studentId" in ctx.holder ? ctx.holder.studentId : (ctx.studentId ?? null),
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

// ── Demo allowance per account holder ───────────────────────────────────────

/** Rows that count towards a holder: the whole family, or the self-managed learner's own (no parent). */
const usageOf = (h: HolderRef) =>
  "parentId" in h ? eq(aiUsage.parentId, h.parentId) : and(eq(aiUsage.studentId, h.studentId), isNull(aiUsage.parentId));

/** Everything this holder has spent on Claude, all time (the demo allowance is not monthly). */
export async function allowanceUsed(h: HolderRef): Promise<number> {
  const [row] = await db.select({ total: sum(aiUsage.costUsd) }).from(aiUsage).where(usageOf(h));
  return Number(row?.total ?? 0);
}

export const allowanceLimit = (h: Pick<Holder, "aiLimitUsd">) => h.aiLimitUsd ?? rules.aiLimits.perAccountUsd;

/** For the sidebar tracker and the limit checks. */
export async function allowanceOf(h: Holder): Promise<AllowanceState> {
  const ref = h.kind === "parent" ? { parentId: h.parentId } : { studentId: h.studentId };
  return allowanceState(await allowanceUsed(ref), allowanceLimit(h));
}

// ── Daily limits per account holder ─────────────────────────────────────────

/** The learners whose activity counts towards a holder: a family's children, or the self-managed learner. */
const learnersOf = (h: Holder) =>
  h.kind === "parent" ? eq(students.parentId, h.parentId) : eq(students.id, h.studentId);

/** True when `column` falls on the holder's current day, in the holder's time zone. */
const holderToday = (h: Holder, column: typeof trackMessages.createdAt | typeof exams.createdAt) =>
  sql`(${column} at time zone ${h.timeZone})::date = (now() at time zone ${h.timeZone})::date`;

export async function chatTurnsToday(h: Holder) {
  const [row] = await db
    .select({ n: count() })
    .from(trackMessages)
    .innerJoin(tracks, eq(tracks.id, trackMessages.trackId))
    .innerJoin(students, eq(students.id, tracks.studentId))
    .where(and(learnersOf(h), inArray(trackMessages.author, ["parent", "learner"]), holderToday(h, trackMessages.createdAt)));
  return row?.n ?? 0;
}

export async function examsWrittenToday(h: Holder) {
  const [row] = await db
    .select({ n: count() })
    .from(exams)
    .innerJoin(students, eq(students.id, exams.studentId))
    .where(and(learnersOf(h), holderToday(h, exams.createdAt)));
  return row?.n ?? 0;
}

/** The start of the holder's next day, as an instant. */
async function nextMidnight(h: Holder): Promise<Date> {
  const res = await db.execute<{ at: Date }>(
    sql`select (date_trunc('day', now() at time zone ${h.timeZone}) + interval '1 day') at time zone ${h.timeZone} as at`,
  );
  return new Date(res.rows[0]?.at ?? Date.now() + 86_400_000);
}

export const CHAT_PAUSED = "The track chat is paused for a little while. Your chat is saved, so please try again later.";
export const chatLimitReached = () =>
  `You've reached today's limit of ${rules.aiLimits.chatTurnsPerDay} messages in track chats. Your chat is saved, so you can carry on tomorrow.`;
export const ALLOWANCE_USED_UP = "Your demo AI allowance is used up. Your chat is saved. Contact us to buy a package and carry on.";

/** Before a holder's chat message goes to Claude. Null when allowed, otherwise the message to show. */
export async function chatBlocked(h: Holder): Promise<string | null> {
  if (!(await budgetLeft())) return CHAT_PAUSED;
  if ((await allowanceOf(h)).usedUp) return ALLOWANCE_USED_UP;
  if ((await chatTurnsToday(h)) >= rules.aiLimits.chatTurnsPerDay) return chatLimitReached();
  return null;
}

export type ExamWriteBlock = { retryAt: Date; reason: "budget" | "allowance" | "daily_limit" };

/** Before an exam is written. When not allowed, says when to try again (the job is rescheduled, not failed). */
export async function examWriteBlocked(h: Holder): Promise<ExamWriteBlock | null> {
  const retrySoon = () => new Date(Date.now() + rules.aiLimits.budgetRetryMinutes * 60_000);
  if (!(await budgetLeft())) return { retryAt: retrySoon(), reason: "budget" };
  // Retried like the budget, so raising the account's limit lets the exam be written without anyone asking again.
  if ((await allowanceOf(h)).usedUp) return { retryAt: retrySoon(), reason: "allowance" };
  if ((await examsWrittenToday(h)) >= rules.aiLimits.examsWrittenPerDay) return { retryAt: await nextMidnight(h), reason: "daily_limit" };
  return null;
}
