import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rules } from "@/config/rules";
import { cleanup, learnerActor, makeParent, makeSelfLearner, makeStudent, makeTrackWithExam } from "../../tests/db-helpers";
import { db } from "./db";
import { aiUsage, consentRequests, jobs, parents, questions } from "./db/schema";
import { getPaper, saveAnswer, startExam, submitExam } from "./exams";
import { deckCounts, deckOf, writeDeck } from "./flashcards";
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
    expect((await deckCounts([trackId])).get(trackId)).toEqual({ total: deck.length, due: deck.length }); // new cards are due now

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
