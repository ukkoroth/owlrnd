import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanup, learnerActor, makeParent, makeSelfLearner, makeStudent, parentActor } from "../../tests/db-helpers";
import { solarSystem } from "@/content/samples/solarSystem";
import { db } from "./db";
import { aiUsage, exams, flashcards, jobs, questions, students, tracks } from "./db/schema";
import { writeExamJob } from "./examWriter";
import { getPaper, saveAnswer, startExam, submitExam } from "./exams";
import { startSession, writeDeck } from "./flashcards";
import { markExamJob } from "./marking";
import { createSampleTrack } from "./tracks";
import { sendUpdateTurn } from "./trackUpdates";

beforeAll(() => {
  process.env.OWLRND_FAKE_AI = "1";
  process.env.STORAGE_DIR = "./storage/test";
});
afterAll(async () => {
  await db.delete(jobs).where(eq(jobs.type, "write_exam"));
  await db.delete(jobs).where(eq(jobs.type, "write_flashcards"));
  await db.delete(jobs).where(eq(jobs.type, "mark_exam"));
  await cleanup();
});
const ctx = { attempt: 1, isLastAttempt: true };
const aiRows = async (studentId: string) => (await db.select().from(aiUsage).where(eq(aiUsage.studentId, studentId))).length;

async function takeAndMark(studentId: string, examId: string) {
  await startExam(studentId, examId);
  const paper = (await getPaper(studentId, examId))!;
  for (const q of paper.questions) {
    const [full] = await db.select().from(questions).where(eq(questions.id, q.id));
    if (q.type === "multiple_choice") await saveAnswer(studentId, examId, q.id, { chosenOption: full!.correctOption, text: null });
    else await saveAnswer(studentId, examId, q.id, { chosenOption: null, text: full!.expectedAnswer!.toLowerCase() });
  }
  await submitExam(studentId, examId);
  await markExamJob({ examId });
}

describe("the Solar System sample track (owner, 2026-11-18)", () => {
  it("is ready at once for a self-managed learner, and its exams come from the bank with no AI", async () => {
    const me = await makeSelfLearner();
    const res = await createSampleTrack(learnerActor(me), me.id);
    if (!res.ok) throw new Error(res.error);
    const [t] = await db.select().from(tracks).where(eq(tracks.id, res.trackId));
    expect(t).toMatchObject({ name: "The Solar System", status: "active", sampleKey: "solar_system", nextExam: "ready", goalThreshold: 8, goalRunLength: 3 });
    expect(await db.select().from(flashcards).where(eq(flashcards.trackId, res.trackId))).toHaveLength(solarSystem.flashcards.length);

    const [first] = await db.select().from(exams).where(eq(exams.trackId, res.trackId));
    expect(first).toMatchObject({ number: 1, status: "ready" });
    await takeAndMark(me.id, first!.id);
    const [marked] = await db.select().from(exams).where(eq(exams.id, first!.id));
    expect(marked).toMatchObject({ status: "marked", score: 10 });

    // Exam 2 from the bank: none of exam 1's questions again.
    await writeExamJob({ trackId: res.trackId }, ctx);
    const [second] = await db.select().from(exams).where(and(eq(exams.trackId, res.trackId), eq(exams.number, 2)));
    expect(second!.status).toBe("ready");
    const prompts = async (examId: string) => (await getPaper(me.id, examId))!.questions.map((q) => q.prompt);
    const one = new Set(await prompts(first!.id));
    expect((await prompts(second!.id)).filter((p) => one.has(p))).toEqual([]);

    // Flashcards: the stored deck, never topped up by the AI; a session always has cards.
    expect(await writeDeck(res.trackId, "top_up")).toEqual({ written: 0 });
    const session = await startSession(learnerActor(me), res.trackId);
    expect(session!.cards.length).toBeGreaterThan(0);

    expect(await aiRows(me.id)).toBe(0);
  });

  it("isn't held back by a used-up AI allowance", async () => {
    const me = await makeSelfLearner();
    await db.update(students).set({ aiLimitUsd: 0 }).where(eq(students.id, me.id));
    const res = await createSampleTrack(learnerActor(me), me.id);
    expect(res.ok).toBe(true);
    const [t] = await db.select().from(tracks).where(eq(tracks.studentId, me.id));
    expect(t!.nextExam).toBe("ready");
  });

  it("a parent adds it for their child; the child can't add it; one per learner; it takes no topics or material", async () => {
    const parent = await makeParent();
    const child = await makeStudent(parent.id);
    expect(await createSampleTrack(learnerActor(child), child.id)).toMatchObject({ ok: false });
    const res = await createSampleTrack(parentActor(parent.id), child.id);
    expect(res.ok).toBe(true);
    expect(await createSampleTrack(parentActor(parent.id), child.id)).toMatchObject({ ok: false, trackId: res.ok ? res.trackId : "" });
    expect(await createSampleTrack(parentActor((await makeParent()).id), child.id)).toMatchObject({ ok: false, error: "Student not found." });
    expect(await sendUpdateTurn(parentActor(parent.id), res.ok ? res.trackId : "", "Add the stars too.", [])).toEqual({ ok: false, error: "Track not found." });
  });
});
