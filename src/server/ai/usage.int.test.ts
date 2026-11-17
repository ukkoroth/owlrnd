import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { rules } from "@/config/rules";
import { holderForParent } from "@/domain/accounts";
import { cleanup, makeParent, makeStudent, makeTrackWithExam, parentActor } from "../../../tests/db-helpers";
import { db } from "../db";
import { aiBudgetAlerts, aiUsage, exams, jobs, parents, trackMessages, tracks } from "../db/schema";
import { setAllowanceLimit } from "../allowances";
import { env } from "../env";
import { writeExamJob } from "../examWriter";
import { sendChatTurn } from "../tracks";
import { alertOwnerIfNeeded, chatBlocked, chatLimitReached, chatTurnsToday, costOf, examWriteBlocked, examsWrittenToday, recordUsage, spendThisMonth, withAiContext } from "./usage";

// Release plan, Phase 1 item 4. Tests that need a full month of spend use January 2099, so they never touch the
// real current month in the shared development database.
const FUTURE = new Date("2099-01-15T12:00:00Z");
const limits = rules.aiLimits as { chatTurnsPerDay: number; examsWrittenPerDay: number };
const saved = { ...limits };

beforeAll(() => {
  process.env.OWLRND_FAKE_AI = "1";
});
afterEach(() => Object.assign(limits, saved));
afterAll(async () => {
  await db.delete(aiUsage).where(and(gte(aiUsage.createdAt, new Date("2099-01-01")), lt(aiUsage.createdAt, new Date("2099-02-01"))));
  await db.delete(aiBudgetAlerts).where(eq(aiBudgetAlerts.month, "2099-01"));
  await db.delete(jobs).where(eq(jobs.type, "write_exam"));
  await cleanup();
});

describe("cost of a call", () => {
  it("prices input, output, cache reads and cache writes per model", () => {
    // Claude Opus 5.5: $4 in, $20 out, $0.20 cache read, cache write 1.25 x input.
    expect(costOf("claude-opus-5-5", { input_tokens: 1_000_000, output_tokens: 0 })).toBe(4);
    expect(costOf("claude-opus-5-5", { input_tokens: 0, output_tokens: 1_000_000 })).toBe(20);
    expect(costOf("claude-opus-5-5", { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 1_000_000, cache_creation_input_tokens: 1_000_000 })).toBe(5.2);
    // A typical exam: 5,000 in, 6,000 out (reasoning included).
    expect(costOf("claude-opus-5-5", { input_tokens: 5_000, output_tokens: 6_000 })).toBeCloseTo(0.14, 6);
    expect(costOf("claude-sonnet-5-5", { input_tokens: 5_000, output_tokens: 6_000 })).toBeCloseTo(0.07, 6);
  });

  it("prices an unknown model like the default, so spend is never under-counted", () => {
    expect(costOf("claude-some-future-model", { input_tokens: 0, output_tokens: 1_000_000 })).toBe(20);
  });
});

describe("recording usage", () => {
  it("records each call with its purpose and family, and nothing outside a context", async () => {
    const parent = await makeParent();
    await withAiContext({ purpose: "write_exam", holder: { parentId: parent.id } }, () => recordUsage("claude-opus-5-5", { input_tokens: 5_000, output_tokens: 6_000 }));
    await recordUsage("claude-opus-5-5", { input_tokens: 1, output_tokens: 1 }); // no context: skipped
    const rows = await db.select().from(aiUsage).where(eq(aiUsage.parentId, parent.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ purpose: "write_exam", model: "claude-opus-5-5", inputTokens: 5_000, outputTokens: 6_000 });
    expect(rows[0]!.costUsd).toBeCloseTo(0.14, 6);
  });
});

describe("monthly budget", () => {
  it("emails the owner once at the warning level and once when the budget is used up", async () => {
    const budget = env().AI_MONTHLY_BUDGET_USD;
    const add = (usd: number) => db.insert(aiUsage).values({ purpose: "write_exam", model: "claude-opus-5-5", inputTokens: 0, outputTokens: 0, costUsd: usd, createdAt: FUTURE });

    await add(budget * rules.aiLimits.budgetWarnAt - 1);
    await alertOwnerIfNeeded(FUTURE);
    expect(await db.select().from(aiBudgetAlerts).where(eq(aiBudgetAlerts.month, "2099-01"))).toHaveLength(0);

    await add(2);
    await alertOwnerIfNeeded(FUTURE);
    await alertOwnerIfNeeded(FUTURE); // a second check sends nothing new
    expect((await db.select().from(aiBudgetAlerts).where(eq(aiBudgetAlerts.month, "2099-01"))).map((a) => a.level)).toEqual(["warn"]);

    await add(budget);
    await alertOwnerIfNeeded(FUTURE);
    const levels = (await db.select().from(aiBudgetAlerts).where(eq(aiBudgetAlerts.month, "2099-01"))).map((a) => a.level).sort();
    expect(levels).toEqual(["reached", "warn"]);
    expect(await spendThisMonth(FUTURE)).toBeGreaterThanOrEqual(budget);
    // The real current month is unaffected by January 2099.
    expect(await spendThisMonth()).toBeLessThan(budget);
  });
});

describe("daily limits per family", () => {
  it("counts the parent's chat messages today and stops the chat at the limit, before calling the AI", async () => {
    const parent = await makeParent();
    const student = await makeStudent(parent.id);
    expect(await chatTurnsToday(holderForParent(parent))).toBe(0);
    const first = await sendChatTurn(parentActor(parent.id), student.id, "Physics chapter 12: Ohm's law.", []);
    expect(first.ok).toBe(true);
    expect(await chatTurnsToday(holderForParent(parent))).toBe(1);

    limits.chatTurnsPerDay = 1;
    expect(await chatBlocked(holderForParent(parent))).toBe(chatLimitReached());
    const before = await db.select().from(trackMessages).innerJoin(tracks, eq(tracks.id, trackMessages.trackId)).where(eq(tracks.studentId, student.id));
    const refused = await sendChatTurn(parentActor(parent.id), student.id, "And resistors in parallel.", []);
    expect(refused).toEqual({ ok: false, error: chatLimitReached() });
    const after = await db.select().from(trackMessages).innerJoin(tracks, eq(tracks.id, trackMessages.trackId)).where(eq(tracks.studentId, student.id));
    expect(after).toHaveLength(before.length); // nothing stored, nothing sent
  });

  it("postpones writing an exam to the family's next day when the daily exam limit is reached", async () => {
    const parent = await makeParent({ timeZone: "Asia/Kolkata" });
    const student = await makeStudent(parent.id);
    const { trackId } = await makeTrackWithExam(parent.id, student.id);
    expect(await examsWrittenToday(holderForParent(parent))).toBe(1);

    limits.examsWrittenPerDay = 1;
    const blocked = await examWriteBlocked(holderForParent(parent));
    expect(blocked?.reason).toBe("daily_limit");
    // Next midnight in Kolkata (UTC+5:30) is 18:30 UTC.
    expect(blocked!.retryAt.toISOString()).toMatch(/T18:30:00\.000Z$/);
    expect(blocked!.retryAt.getTime()).toBeGreaterThan(Date.now());

    // Close the open exam so the writer would otherwise write the next one.
    await db.update(exams).set({ status: "marked" }).where(eq(exams.trackId, trackId));
    const examsBefore = await db.select().from(exams).where(eq(exams.trackId, trackId));
    await writeExamJob({ trackId }, { attempt: 1, isLastAttempt: false });
    expect(await db.select().from(exams).where(eq(exams.trackId, trackId))).toHaveLength(examsBefore.length);
    const queued = await db.select().from(jobs).where(and(eq(jobs.type, "write_exam"), eq(jobs.status, "queued")));
    // (The track's creation also queued an immediate write_exam job; the postponed one is scheduled later.)
    const retry = queued.find((j) => (j.payload as { trackId: string }).trackId === trackId && j.runAt.getTime() > Date.now() + 60_000);
    expect(retry?.runAt.toISOString()).toBe(blocked!.retryAt.toISOString());
    await db.delete(jobs).where(inArray(jobs.id, queued.map((j) => j.id)));
  });

  it("marks the track on hold while the allowance is used up, and writes the exam as soon as it's raised", async () => {
    const parent = await makeParent();
    const student = await makeStudent(parent.id);
    const { trackId } = await makeTrackWithExam(parent.id, student.id);
    await db.update(exams).set({ status: "marked" }).where(eq(exams.trackId, trackId));
    await db.delete(jobs).where(eq(jobs.type, "write_exam"));
    await db.update(parents).set({ aiLimitUsd: 0 }).where(eq(parents.id, parent.id));

    await writeExamJob({ trackId }, { attempt: 1, isLastAttempt: false });
    const [held] = await db.select().from(tracks).where(eq(tracks.id, trackId));
    expect(held!.nextExamHold).toBe("allowance");
    const [retry] = await db.select().from(jobs).where(and(eq(jobs.type, "write_exam"), eq(jobs.status, "queued")));
    expect(retry!.runAt.getTime()).toBeGreaterThan(Date.now() + 60_000);

    // The owner raises the allowance: the postponed job is due now, not in an hour.
    const res = await setAllowanceLimit(parent.email, 50);
    expect(res?.resumed).toBe(1);
    const [due] = await db.select().from(jobs).where(eq(jobs.id, retry!.id));
    expect(due!.runAt.getTime()).toBeLessThanOrEqual(Date.now());

    await writeExamJob({ trackId }, { attempt: 1, isLastAttempt: false });
    const [written] = await db.select().from(tracks).where(eq(tracks.id, trackId));
    expect(written).toMatchObject({ nextExam: "ready", nextExamHold: null });
    await db.delete(jobs).where(eq(jobs.type, "write_exam"));
  });
});
