import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanup, makeParent, makeStudent, makeTrackWithExam } from "../../tests/db-helpers";
import { db } from "./db";
import { exams, jobs, questions, tracks } from "./db/schema";
import { getPaper, getStudentDashboard, rushCheck, saveAnswer, startExam, submitExam } from "./exams";

beforeAll(() => {
  process.env.OWLRND_FAKE_AI = "1";
  process.env.STORAGE_DIR = "./storage/test";
});
afterAll(async () => {
  await db.delete(jobs).where(eq(jobs.type, "write_exam"));
  await cleanup();
});

async function setup() {
  const parent = await makeParent();
  const student = await makeStudent(parent.id, { name: "Scout" });
  const { trackId, examId } = await makeTrackWithExam(parent.id, student.id);
  return { parent, student, trackId, examId };
}

describe("rushed papers (rules §5a)", () => {
  it("won't hand in an empty, keyboard-mash or seconds-old paper", async () => {
    const { student, examId } = await setup();
    await startExam(student.id, examId);
    const paper = (await getPaper(student.id, examId))!;
    const started = paper.startedAt!;
    const later = (s: number) => new Date(started + s * 1000);
    expect(await rushCheck(student.id, examId, later(600))).toMatchObject({ reason: "too_few", answered: 0, needed: 5 });

    const mcqs = paper.questions.filter((q) => q.type === "multiple_choice");
    const shorts = paper.questions.filter((q) => q.type === "short");
    for (const q of mcqs.slice(0, 3)) await saveAnswer(student.id, examId, q.id, { chosenOption: 0, text: null });
    for (const q of shorts.slice(0, 2)) await saveAnswer(student.id, examId, q.id, { chosenOption: null, text: "qwfciewondcveh" });
    expect(await rushCheck(student.id, examId, later(600))).toMatchObject({ reason: "too_few", answered: 3 });

    for (const q of shorts.slice(0, 2)) await saveAnswer(student.id, examId, q.id, { chosenOption: null, text: "x + 1" });
    expect(await rushCheck(student.id, examId, later(20))).toEqual({ reason: "too_fast", waitSeconds: 30 });
    expect(await rushCheck(student.id, examId, later(50))).toBeNull();

    process.env.OWLRND_RUSH_GUARD = "off";
    try {
      expect(await rushCheck(student.id, examId, later(1))).toBeNull();
    } finally {
      delete process.env.OWLRND_RUSH_GUARD;
    }
  });
});

describe("taking an exam", () => {
  it("suggests the first exam, then starts, saves answers and submits", async () => {
    const { student, examId } = await setup();
    const dash = await getStudentDashboard(student.id);
    expect(dash.firstDay).toBe(true);
    expect(dash.suggestions.map((s) => s.exam?.id)).toEqual([examId]);

    expect(await startExam(student.id, examId)).toBe(true);
    const paper = (await getPaper(student.id, examId))!;
    expect(paper.status).toBe("in_progress");
    expect(paper.questions).toHaveLength(10);

    const mcq = paper.questions.find((q) => q.type === "multiple_choice")!;
    const short = paper.questions.find((q) => q.type === "short")!;
    expect(await saveAnswer(student.id, examId, mcq.id, { chosenOption: 2, text: null })).toBe(true);
    expect(await saveAnswer(student.id, examId, mcq.id, { chosenOption: 1, text: "ignored" })).toBe(true); // upsert
    expect(await saveAnswer(student.id, examId, short.id, { chosenOption: 3, text: "x".repeat(500) })).toBe(true);
    const saved = (await getPaper(student.id, examId))!.answers;
    expect(saved[mcq.id]).toEqual({ chosenOption: 1, text: null });
    expect(saved[short.id]).toEqual({ chosenOption: null, text: "x".repeat(300) });

    expect(await submitExam(student.id, examId)).toBe(true);
    expect(await submitExam(student.id, examId)).toBe(true); // idempotent
    const [row] = await db.select().from(exams).where(eq(exams.id, examId));
    expect(row!.status).toBe("marking"); // marked in the background (M5)
    expect(row!.submittedAt).not.toBeNull();

    // No more saving once submitted; the exam moves to Recent exams.
    expect(await saveAnswer(student.id, examId, mcq.id, { chosenOption: 0, text: null })).toBe(false);
    const after = await getStudentDashboard(student.id);
    expect(after.recent.map((r) => r.id)).toEqual([examId]);
    expect(after.recent[0]!.submittedAt).toBeInstanceOf(Date); // the dashboard formats it as a date
    expect(after.suggestions).toHaveLength(0);
    expect(after.firstDay).toBe(false);
  });

  it("never sends correct answers or explanations to the student", async () => {
    const { student, examId } = await setup();
    const paper = await getPaper(student.id, examId);
    const json = JSON.stringify(paper);
    const qs = await db.select().from(questions).where(eq(questions.id, paper!.questions[0]!.id));
    expect(json).not.toMatch(/correctOption|expectedAnswer|explanation/);
    expect(json).not.toContain(qs[0]!.explanation);
  });

  it("keeps students out of other students' exams", async () => {
    const { examId } = await setup();
    const parent = await makeParent();
    const other = await makeStudent(parent.id);
    expect(await getPaper(other.id, examId)).toBeNull();
    expect(await startExam(other.id, examId)).toBe(false);
    expect(await saveAnswer(other.id, examId, "00000000-0000-0000-0000-000000000000", { chosenOption: 0, text: null })).toBe(false);
    expect(await submitExam(other.id, examId)).toBe(false);
  });

  it("doesn't start an exam on a paused track, or save before starting", async () => {
    const { student, examId, trackId } = await setup();
    const paper = (await getPaper(student.id, examId))!;
    expect(await saveAnswer(student.id, examId, paper.questions[0]!.id, { chosenOption: 0, text: null })).toBe(false);
    await db.update(tracks).set({ status: "paused" }).where(eq(tracks.id, trackId));
    expect(await startExam(student.id, examId)).toBe(false);
    expect((await getStudentDashboard(student.id)).suggestions).toHaveLength(0);
  });
});
