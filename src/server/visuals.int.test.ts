import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanup, learnerActor, makeParent, makeStudent, makeTrackWithExam, parentActor } from "../../tests/db-helpers";
import { sampleVisuals } from "@/content/visuals/samples";
import { db } from "./db";
import { examQuestions, exams, flashcards, jobs, questions, topics } from "./db/schema";
import { writeExamJob } from "./examWriter";
import { getPaper, saveAnswer, startExam, submitExam } from "./exams";
import { startSession } from "./flashcards";
import { markExamJob } from "./marking";
import { getMarkedPaper } from "./results";
import { createSampleTrack } from "./tracks";
import { drawBatch, drawVisualsJob, VISUAL_SKIPPED } from "./visuals";

// Pictures for questions and cards (docs/plan-wrong-answer-visuals.md). Fake AI: items mentioning an angle get the
// sample picture, the rest none.
beforeAll(() => {
  process.env.OWLRND_FAKE_AI = "1";
  process.env.STORAGE_DIR = "./storage/test";
});
afterAll(async () => {
  await db.delete(jobs).where(sql`${jobs.type} in ('write_exam', 'write_pool', 'write_flashcards', 'mark_exam', 'draw_visuals')`);
  await cleanup();
});
const ctx = { attempt: 1, isLastAttempt: true };
const visualJobsFor = async (trackId: string) =>
  (await db.select().from(jobs).where(and(eq(jobs.type, "draw_visuals"), eq(jobs.status, "queued")))).filter((j) => (j.payload as { trackId: string }).trackId === trackId);
const examQs = async (examId: string) =>
  (await db.select({ q: questions }).from(examQuestions).innerJoin(questions, eq(questions.id, examQuestions.questionId)).where(eq(examQuestions.examId, examId)).orderBy(examQuestions.position)).map((r) => r.q);

async function freshTrack() {
  const parent = await makeParent();
  const student = await makeStudent(parent.id);
  const { trackId, examId } = await makeTrackWithExam(parent.id, student.id);
  return { parent, student, trackId, examId };
}

describe("pictures for questions and cards", () => {
  it("are drawn in the background after a paper is written, and show under a wrong answer once it's marked", async () => {
    const { student, trackId, examId } = await freshTrack();
    expect(await visualJobsFor(trackId)).toHaveLength(1);
    const [first, second] = await examQs(examId);
    await db.update(questions).set({ prompt: "A ray makes an angle of 54° with a mirror. What is the angle of incidence?" }).where(eq(questions.id, first!.id));

    await drawVisualsJob({ trackId }, ctx);
    const after = await examQs(examId);
    expect(after.every((q) => q.visualDrawnAt && q.visualDrawnAt > VISUAL_SKIPPED)).toBe(true);
    expect(after[0]!.visual).toEqual(sampleVisuals[0]!.scene);
    expect(after.find((q) => q.id === second!.id)!.visual).toBeNull(); // no picture helps

    // Answer everything wrong, then the marked paper carries the picture.
    await startExam(student.id, examId);
    const paper = (await getPaper(student.id, examId))!;
    for (const q of paper.questions) await saveAnswer(student.id, examId, q.id, q.type === "multiple_choice" ? { chosenOption: 3, text: null } : { chosenOption: null, text: "no idea" });
    await submitExam(student.id, examId);
    await markExamJob({ examId });
    const marked = (await getMarkedPaper(student.id, examId))!;
    expect(marked.questions[0]!.visual).toEqual(sampleVisuals[0]!.scene);
    expect(marked.questions[1]!.visual).toBeNull();
  });

  it("draws old pool questions only when an exam picks them", async () => {
    const { student, trackId, examId } = await freshTrack();
    await drawVisualsJob({ trackId }, ctx);
    // Exam 1 marked, then a stock of old questions written "before pictures existed".
    await startExam(student.id, examId);
    await submitExam(student.id, examId);
    await markExamJob({ examId });
    const [topic] = await db.select().from(topics).where(eq(topics.trackId, trackId));
    await db.insert(questions).values(
      Array.from({ length: 30 }, (_, i) => ({ trackId, topicId: topic!.id, type: "short" as const, prompt: `Old question ${i} about an angle`, expectedAnswer: "x", difficulty: 2, explanation: "Because.", visualDrawnAt: VISUAL_SKIPPED })),
    );
    await db.delete(jobs).where(eq(jobs.type, "draw_visuals"));

    await writeExamJob({ trackId }, ctx);
    const [second] = await db.select().from(exams).where(and(eq(exams.trackId, trackId), eq(exams.number, 2)));
    const picked = await examQs(second!.id);
    expect(picked.some((q) => q.prompt.startsWith("Old question"))).toBe(true);
    expect(picked.every((q) => q.visualDrawnAt === null || q.visualDrawnAt > VISUAL_SKIPPED)).toBe(true);
    expect(await visualJobsFor(trackId)).toHaveLength(1);
    // Old questions the exam didn't pick stay skipped.
    const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`count(*)::int` }).from(questions).where(and(eq(questions.trackId, trackId), eq(questions.visualDrawnAt, VISUAL_SKIPPED)));
    expect(n).toBe(30 - picked.filter((q) => q.prompt.startsWith("Old question")).length);
  });

  it("gives a card made from a missed question that question's picture, without asking the AI", async () => {
    const { trackId, examId } = await freshTrack();
    const [q] = await examQs(examId);
    await db.update(questions).set({ visual: sampleVisuals[1]!.scene, visualDrawnAt: new Date() }).where(eq(questions.trackId, trackId));
    await db.insert(flashcards).values({ trackId, topicId: q!.topicId, front: "Front", answer: "Answer", explanation: "Why.", source: "missed_question", sourceQuestionId: q!.id });
    const res = await drawBatch(trackId);
    expect(res).toEqual({ drawn: 0, pictures: 0 });
    const [card] = await db.select().from(flashcards).where(and(eq(flashcards.trackId, trackId), eq(flashcards.sourceQuestionId, q!.id)));
    expect(card!.visual).toEqual(sampleVisuals[1]!.scene);
    expect(card!.visualDrawnAt).not.toBeNull();
  });

  it("draws an old card when a session picks it, and a session hands the card's picture to the answer side", async () => {
    const { student, trackId } = await freshTrack();
    await db.delete(flashcards).where(eq(flashcards.trackId, trackId));
    const [topic] = await db.select().from(topics).where(eq(topics.trackId, trackId));
    await db.insert(flashcards).values([
      { trackId, topicId: topic!.id, front: "Old card about a mirror", answer: "36°", explanation: "From the normal.", visualDrawnAt: VISUAL_SKIPPED },
      { trackId, topicId: topic!.id, front: "Drawn card", answer: "x", explanation: "y", visual: sampleVisuals[2]!.scene, visualDrawnAt: new Date() },
    ]);
    await db.delete(jobs).where(eq(jobs.type, "draw_visuals"));
    const session = (await startSession(learnerActor(student), trackId))!;
    expect(session.cards.find((c) => c.front === "Drawn card")!.visual).toEqual(sampleVisuals[2]!.scene);
    expect(await visualJobsFor(trackId)).toHaveLength(1);
    // Questions are drawn first, a batch at a time; the job queues itself again until the card is done too.
    for (let i = 0; i < 5; i++) {
      const res = await drawBatch(trackId);
      if ("drawn" in res && res.drawn === 0) break;
    }
    const [old] = await db.select().from(flashcards).where(and(eq(flashcards.trackId, trackId), eq(flashcards.front, "Old card about a mirror")));
    expect(old!.visual).toEqual(sampleVisuals[0]!.scene);
  });

  it("never draws for a sample track", async () => {
    const parent = await makeParent();
    const student = await makeStudent(parent.id);
    const res = await createSampleTrack(parentActor(parent.id), student.id);
    if (!res.ok) throw new Error(res.error);
    await writeExamJob({ trackId: res.trackId }, ctx);
    expect(await drawBatch(res.trackId)).toEqual({ skipped: "no pictures for this track" });
    expect(await visualJobsFor(res.trackId)).toHaveLength(0);
  });
});
