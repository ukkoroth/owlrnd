import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rules } from "@/config/rules";
import { cleanup, learnerActor, makeParent, parentActor, makeSelfLearner, makeStudent, makeTrackWithExam } from "../../tests/db-helpers";
import { db } from "./db";
import { aiUsage, consentRequests, jobs, parents, pointsEvents, questions, tracks } from "./db/schema";
import { getPaper, saveAnswer, startExam, submitExam } from "./exams";
import { deckCounts, deckOf, deckPage, finishSession, flashcardActivity, reviewCard, startSession, writeDeck } from "./flashcards";
import { getStudentDashboard } from "./exams";
import { practiceTimes } from "./results";
import { markExamJob } from "./marking";
import { requestConsent } from "./consent";

// 0.3 Flashcards, F1: writing a track's deck (fake AI).
beforeAll(() => {
  process.env.OWLRND_FAKE_AI = "1";
  process.env.EMAIL_TRANSPORT = "smtp";
});
afterAll(cleanup);

async function family() {
  const parent = await makeParent();
  const student = await makeStudent(parent.id, { name: "Scout", timeZone: "UTC" });
  return { parent, student, ...(await makeTrackWithExam(parent.id, student.id)) };
}

/** Takes the exam and gets every question wrong, then marks it. */
async function failExam(studentId: string, examId: string) {
  await startExam(studentId, examId);
  const paper = (await getPaper(studentId, examId))!;
  for (const q of paper.questions) {
    const [full] = await db.select().from(questions).where(eq(questions.id, q.id));
    if (q.type === "multiple_choice") await saveAnswer(studentId, examId, q.id, { chosenOption: ((full!.correctOption ?? 0) + 1) % 4, text: null });
    else await saveAnswer(studentId, examId, q.id, { chosenOption: null, text: "no idea" });
  }
  await submitExam(studentId, examId);
  await markExamJob({ examId });
}

describe("the starter deck", () => {
  it("creating a track queues it; it writes about 6 cards per topic, once", async () => {
    const { trackId } = await family();
    const queued = (await db.select().from(jobs).where(eq(jobs.type, "write_flashcards"))).filter((j) => (j.payload as { trackId: string }).trackId === trackId);
    expect(queued.map((j) => (j.payload as { reason: string }).reason)).toContain("starter");

    const first = await writeDeck(trackId, "starter");
    const deck = await deckOf(trackId);
    const topicsCount = new Set(deck.map((c) => c.topicId)).size;
    expect(first).toEqual({ written: rules.flashcards.starterPerTopic * topicsCount });
    expect(deck.every((c) => c.source === "material" && c.box === 1)).toBe(true);
    expect((await deckCounts([trackId])).get(trackId)).toMatchObject({ total: deck.length, due: deck.length }); // new cards are due now

    expect(await writeDeck(trackId, "starter")).toEqual({ written: 0 }); // already has its cards
  });
});

describe("cards from missed questions", () => {
  it("up to 3 missed questions on topics needing work become cards, each only once; marking queues it", async () => {
    const { student, trackId, examId } = await family();
    await failExam(student.id, examId);
    const queued = (await db.select().from(jobs).where(eq(jobs.type, "write_flashcards"))).filter((j) => (j.payload as { examId?: string }).examId === examId);
    expect(queued).toHaveLength(1);

    expect(await writeDeck(trackId, "missed", examId)).toEqual({ written: rules.flashcards.missedPerExam });
    const deck = await deckOf(trackId);
    expect(deck.every((c) => c.source === "missed_question" && c.sourceQuestionId)).toBe(true);
    expect(await writeDeck(trackId, "missed", examId)).toEqual({ written: 0 });
  });
});

describe("top-up and limits", () => {
  it("a top-up writes 10 more cards", async () => {
    const { trackId } = await family();
    await writeDeck(trackId, "starter");
    const before = (await deckOf(trackId)).length;
    expect(await writeDeck(trackId, "top_up")).toEqual({ written: rules.flashcards.topUp });
    expect((await deckOf(trackId)).length).toBe(before + rules.flashcards.topUp);
  });

  it("waits while the AI allowance is used up", async () => {
    const { parent, trackId } = await family();
    await db.update(parents).set({ aiLimitUsd: 1 }).where(eq(parents.id, parent.id));
    await db.insert(aiUsage).values({ parentId: parent.id, purpose: "write_exam", model: "claude-opus-5-5", inputTokens: 0, outputTokens: 0, costUsd: 2, createdAt: new Date("2020-01-15") });
    expect(await writeDeck(trackId, "starter")).toEqual({ postponed: "allowance" });
    expect(await deckOf(trackId)).toHaveLength(0);
  });

  it("waits while a parent's consent pauses an under-18 learner's practice", async () => {
    const learner = await makeSelfLearner({ dateOfBirth: `${new Date().getUTCFullYear() - 15}-01-01` });
    const { trackId } = await makeTrackWithExam(learnerActor(learner), learner.id);
    const res = await requestConsent(learner, { parentName: "Parent", parentEmail: `p-${learner.id.slice(0, 8)}@test.owlrnd` });
    if (!res.ok) throw new Error("consent request");
    await db.update(consentRequests).set({ createdAt: new Date(Date.now() - 31 * 24 * 60 * 60_000) }).where(eq(consentRequests.id, res.request.id));
    expect(await writeDeck(trackId, "starter")).toEqual({ postponed: "consent" });
  });

  it("each track's deck is its own", async () => {
    const a = await family();
    const b = await family();
    await writeDeck(a.trackId, "starter");
    expect(await deckOf(b.trackId)).toHaveLength(0);
  });
});

// F2: a practice session (fc-2 to fc-4).
const DAY = 24 * 60 * 60_000;

describe("a practice session", () => {
  it("picks up to 10 due cards; answers move boxes; the summary counts by topic", async () => {
    const { parent, student, trackId } = await family();
    await writeDeck(trackId, "starter");
    const me = learnerActor(student);
    const now = new Date();
    const session = (await startSession(me, trackId, {}, now))!;
    expect(session.cards).toHaveLength(rules.flashcards.sessionSize);
    expect(session.sessionId).toBeTruthy();

    const [a, b, ...rest] = session.cards;
    expect(await reviewCard(me, session.sessionId, a!.id, "got_it", now)).toBe(true);
    expect(await reviewCard(me, session.sessionId, b!.id, "not_yet", now)).toBe(true);
    expect(await reviewCard(me, session.sessionId, b!.id, "got_it", now)).toBe(true); // second answer ignored
    for (const c of rest) await reviewCard(me, session.sessionId, c.id, "got_it", now);

    const deck = new Map((await deckOf(trackId)).map((c) => [c.id, c]));
    expect(deck.get(a!.id)!.box).toBe(2);
    expect(deck.get(a!.id)!.dueAt.getTime()).toBe(now.getTime() + rules.flashcards.boxDays[1]! * DAY);
    expect(deck.get(b!.id)!.box).toBe(1);
    expect(deck.get(b!.id)!.dueAt.getTime()).toBe(now.getTime() + rules.flashcards.boxDays[0]! * DAY);

    const later = new Date(now.getTime() + 3 * 60_000);
    const summary = (await finishSession(me, session.sessionId, later))!;
    expect(summary).toMatchObject({ cardsSeen: 10, gotIt: 9, notYet: 1, minutes: 3 });
    expect(summary.byTopic.reduce((n, t) => n + t.seen, 0)).toBe(10);
    expect(summary.readyExam?.id).toBeTruthy();
    expect(summary.next?.count).toBeGreaterThan(0);

    // Finished: no more answers. The parent can't practise or read it.
    expect(await reviewCard(me, session.sessionId, a!.id, "not_yet")).toBe(false);
    expect(await startSession(parentActor(parent.id), trackId)).toBeNull();
    expect(await finishSession(parentActor(parent.id), session.sessionId)).toBeNull();

    // "Practise these again": just the "Not yet" card.
    const again = (await startSession(me, trackId, { again: session.sessionId }, later))!;
    expect(again.cards.map((c) => c.id)).toEqual([b!.id]);
  });

  it("another learner can't use the session, its cards or the track", async () => {
    const mine = await family();
    const other = await family();
    await writeDeck(mine.trackId, "starter");
    const session = (await startSession(learnerActor(mine.student), mine.trackId))!;
    const them = learnerActor(other.student);
    expect(await startSession(them, mine.trackId)).toBeNull();
    expect(await reviewCard(them, session.sessionId, session.cards[0]!.id, "got_it")).toBe(false);
    expect(await finishSession(them, session.sessionId)).toBeNull();
    expect(await startSession(them, other.trackId, { again: session.sessionId })).toMatchObject({ cards: [] });

    // A card from another track can't be answered in this session.
    await writeDeck(other.trackId, "starter");
    const [foreign] = await deckOf(other.trackId);
    expect(await reviewCard(learnerActor(mine.student), session.sessionId, foreign!.id, "got_it")).toBe(false);
  });

  it("with nothing due, a top-up is written before the session starts", async () => {
    const { student, trackId } = await family();
    const session = (await startSession(learnerActor(student), trackId))!;
    expect(session.cards).toHaveLength(rules.flashcards.topUp);
  });

  it("a learner whose practice is paused for consent can't start one", async () => {
    const learner = await makeSelfLearner({ dateOfBirth: `${new Date().getUTCFullYear() - 15}-01-01` });
    const { trackId } = await makeTrackWithExam(learnerActor(learner), learner.id);
    expect(await startSession({ ...learnerActor(learner), practiseBlocked: true } as never, trackId)).toBeNull();
  });
});

// F3: points, counts and the deck page.
async function practise(me: ReturnType<typeof learnerActor>, trackId: string, n: number, at: Date) {
  const s = (await startSession(me, trackId, {}, at))!;
  for (const c of s.cards.slice(0, n)) await reviewCard(me, s.sessionId, c.id, "got_it", at);
  return finishSession(me, s.sessionId, at);
}

describe("flashcard points", () => {
  it("5 for 8+ cards, at most 2 sessions a day per track, once per session, never for a short one", async () => {
    const { student, trackId } = await family();
    const me = learnerActor(student);
    await writeDeck(trackId, "starter");
    await writeDeck(trackId, "top_up");
    await writeDeck(trackId, "top_up");
    const day = new Date("2026-11-16T09:00:00Z");
    // Practise in the future so every card is due; each session sees fresh due cards.
    const at = (h: number) => new Date(day.getTime() + 40 * DAY + h * 60 * 60_000);

    expect((await practise(me, trackId, 7, at(0)))!.points).toBe(0); // short
    const first = (await practise(me, trackId, 8, at(1)))!;
    expect(first.points).toBe(rules.flashcards.points.perSession);
    expect((await practise(me, trackId, 10, at(2)))!.points).toBe(rules.flashcards.points.perSession);
    expect((await practise(me, trackId, 10, at(3)))!.points).toBe(0); // third today on this track

    const events = await db.select().from(pointsEvents).where(eq(pointsEvents.studentId, student.id));
    expect(events.map((e) => [e.kind, e.points, e.examId])).toEqual([
      ["flashcards", 5, null],
      ["flashcards", 5, null],
    ]);
    expect(events[0]!.label).toMatch(/^Flashcards: /);
  });

  it("finishing the same session twice awards it once", async () => {
    const { student, trackId } = await family();
    const me = learnerActor(student);
    await writeDeck(trackId, "starter");
    const s = (await startSession(me, trackId))!;
    for (const c of s.cards) await reviewCard(me, s.sessionId, c.id, "got_it");
    const [a, b] = await Promise.all([finishSession(me, s.sessionId), finishSession(me, s.sessionId)]);
    expect([a!.points, b!.points]).toEqual([5, 5]); // both summaries show the session's points…
    expect(await db.select().from(pointsEvents).where(eq(pointsEvents.studentId, student.id))).toHaveLength(1); // …awarded once
  });
});

describe("counts and the deck page", () => {
  it("counts due, known and the last session; the deck page lists cards by topic for the learner only", async () => {
    const { parent, student, trackId } = await family();
    const me = learnerActor(student);
    await writeDeck(trackId, "starter");
    const before = (await deckCounts([trackId])).get(trackId)!;
    expect(before).toMatchObject({ due: before.total, known: 0, practise: rules.flashcards.sessionSize, lastAt: null });

    await practise(me, trackId, 10, new Date());
    const after = (await deckCounts([trackId])).get(trackId)!;
    expect(after.due).toBe(before.total - 10);
    expect(after.lastAt).toBeInstanceOf(Date);

    const page = (await deckPage(me, trackId))!;
    expect(page.topics.flatMap((t) => t.cards)).toHaveLength(before.total);
    expect(page.topics.flatMap((t) => t.cards).filter((c) => c.state === "learning")).toHaveLength(10);
    expect(await deckPage(parentActor(parent.id), trackId)).toBeNull();
    expect(await deckPage(learnerActor((await family()).student), trackId)).toBeNull();
  });

  it("a paused track can't be practised; a goal-reached one can", async () => {
    const { student, trackId } = await family();
    const me = learnerActor(student);
    await writeDeck(trackId, "starter");
    await db.update(tracks).set({ status: "paused" }).where(eq(tracks.id, trackId));
    expect(await startSession(me, trackId)).toBeNull();
    await db.update(tracks).set({ status: "goal_reached" }).where(eq(tracks.id, trackId));
    expect((await startSession(me, trackId))!.cards.length).toBeGreaterThan(0);
  });
});

// F4: activity for the charts and the parent's line; never counted as exams.
describe("flashcard activity", () => {
  it("counts sessions with answers this week, per track, and cards known; nothing counts as an exam", async () => {
    const { student, trackId } = await family();
    const me = learnerActor(student);
    await writeDeck(trackId, "starter");
    await practise(me, trackId, 10, new Date());
    await startSession(me, trackId); // opened, nothing answered: not a session to count

    const a = await flashcardActivity(student.id);
    expect(a.times).toHaveLength(1);
    expect(a.sessionsWeek).toBe(1);
    expect(a.perTrack.get(trackId)).toMatchObject({ sessionsWeek: 1, known: 0 });
    expect(a.perTrack.get(trackId)!.total).toBeGreaterThan(0);

    expect(await practiceTimes(student.id)).toHaveLength(0);
    const dash = await getStudentDashboard(student.id);
    expect(dash.completed).toBe(0);
    expect(dash.recent).toHaveLength(0);
  });

  it("a session more than 7 days ago is in the chart's times but not this week's count", async () => {
    const { student, trackId } = await family();
    await writeDeck(trackId, "starter");
    await practise(learnerActor(student), trackId, 8, new Date(Date.now() - 9 * DAY));
    const a = await flashcardActivity(student.id);
    expect([a.times.length, a.sessionsWeek]).toEqual([1, 0]);
  });
});
