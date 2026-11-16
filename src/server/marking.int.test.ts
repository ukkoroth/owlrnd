import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, makeParent, makeStudent, makeTrackWithExam } from "../../tests/db-helpers";
import * as fake from "./ai/fake";
import { db } from "./db";
import { examQuestions, exams, jobs, marks, pointsEvents, questions, topicResults, topics, tracks } from "./db/schema";
import { writeExamJob } from "./examWriter";
import { getPaper, saveAnswer, startExam, submitExam } from "./exams";
import { markExamJob } from "./marking";
import { topicStrengths } from "./progress";
import { getResult } from "./results";

beforeAll(() => {
  process.env.OWLRND_FAKE_AI = "1";
  process.env.STORAGE_DIR = "./storage/test";
});
afterAll(async () => {
  await db.delete(jobs).where(eq(jobs.type, "write_exam"));
  await db.delete(jobs).where(eq(jobs.type, "mark_exam"));
  await cleanup();
});
const ctx = { attempt: 1, isLastAttempt: true };

/** Takes an exam: `right(topicName)` decides whether each answer is correct. */
async function takeExam(studentId: string, examId: string, right: (topic: string) => boolean | "blank" | "reworded") {
  await startExam(studentId, examId);
  const paper = (await getPaper(studentId, examId))!;
  for (const q of paper.questions) {
    const [full] = await db.select({ q: questions, t: topics }).from(questions).innerJoin(topics, eq(topics.id, questions.topicId)).where(eq(questions.id, q.id));
    const how = right(full!.t.name);
    if (how === "blank") continue;
    if (q.type === "multiple_choice") await saveAnswer(studentId, examId, q.id, { chosenOption: how ? full!.q.correctOption : 3, text: null });
    else await saveAnswer(studentId, examId, q.id, { chosenOption: null, text: how === "reworded" ? `my idea is ${full!.t.name}` : how ? full!.q.expectedAnswer : "no idea" });
  }
  await submitExam(studentId, examId);
}

async function family() {
  const parent = await makeParent();
  const student = await makeStudent(parent.id, { name: "Scout", timeZone: "UTC" });
  const t = await makeTrackWithExam(parent.id, student.id);
  return { parent, student, ...t };
}

describe("marking (rules §6) and the next exam (rules §4)", () => {
  it("marks, scores, records topic strength and points, then writes an exam that leans on the weak topic", async () => {
    const { student, trackId, examId } = await family();
    await takeExam(student.id, examId, (topic) => topic !== "Resistors in parallel");
    expect((await db.select().from(exams).where(eq(exams.id, examId)))[0]!.status).toBe("marking");
    expect((await db.select().from(jobs).where(eq(jobs.type, "mark_exam"))).some((j) => (j.payload as { examId: string }).examId === examId)).toBe(true);

    await markExamJob({ examId });

    const [exam] = await db.select().from(exams).where(eq(exams.id, examId));
    const ms = await db.select().from(marks).where(eq(marks.examId, examId));
    const parallel = (await db.select().from(topics).where(and(eq(topics.trackId, trackId), eq(topics.name, "Resistors in parallel"))))[0]!;
    const parallelQs = (await db.select().from(examQuestions).innerJoin(questions, eq(questions.id, examQuestions.questionId)).where(eq(examQuestions.examId, examId))).filter(
      (r) => r.questions.topicId === parallel.id,
    ).length;
    expect(ms).toHaveLength(10);
    expect(exam).toMatchObject({ status: "marked", score: 10 - parallelQs });
    expect(ms.filter((m) => m.verdict === "missed")).toHaveLength(parallelQs);

    const strength = (await topicStrengths(student.id, [trackId])).get(trackId)!;
    expect(strength.find((t) => t.name === "Resistors in parallel")!.strength).toBe("needs_work");
    expect(strength.find((t) => t.name === "Ohm's law")!.strength).toBe("strong"); // 4 of 4

    const pts = await db.select().from(pointsEvents).where(eq(pointsEvents.examId, examId));
    expect(pts.map((p) => [p.kind, p.points])).toEqual([
      ["finish", 10],
      ["correct", 2 * (10 - parallelQs)],
    ]);

    // The next exam: queued by marking, written by the job, and mostly on the weak topic.
    const [track] = await db.select().from(tracks).where(eq(tracks.id, trackId));
    expect(track).toMatchObject({ nextExam: "writing", status: "active", goalProgress: 0 });
    await writeExamJob({ trackId }, ctx);
    const [exam2] = await db.select().from(exams).where(and(eq(exams.trackId, trackId), eq(exams.number, 2)));
    expect(exam2!.status).toBe("ready");
    const qs2 = await db.select().from(examQuestions).innerJoin(questions, eq(questions.id, examQuestions.questionId)).where(eq(examQuestions.examId, exam2!.id));
    expect(qs2.filter((r) => r.questions.topicId === parallel.id).length).toBeGreaterThanOrEqual(5);
    // No identical question from the last exam (rules §4).
    const prompts1 = new Set((await db.select().from(examQuestions).innerJoin(questions, eq(questions.id, examQuestions.questionId)).where(eq(examQuestions.examId, examId))).map((r) => r.questions.prompt));
    expect(qs2.filter((r) => prompts1.has(r.questions.prompt))).toHaveLength(0);
  });

  it("is idempotent", async () => {
    const { student, examId } = await family();
    await takeExam(student.id, examId, () => true);
    await markExamJob({ examId });
    await markExamJob({ examId });
    expect(await db.select().from(marks).where(eq(marks.examId, examId))).toHaveLength(10);
    expect(await db.select().from(topicResults).where(eq(topicResults.examId, examId))).toHaveLength(10);
    const pts = await db.select().from(pointsEvents).where(eq(pointsEvents.examId, examId));
    expect(pts.map((p) => p.kind)).toEqual(["finish", "correct", "perfect"]);
  });

  it("sends only non-trivial short answers to the AI; blanks are wrong, exact matches right", async () => {
    const { student, examId } = await family();
    const spy = vi.spyOn(fake, "fakeMarkAnswers");
    await takeExam(student.id, examId, (topic) => (topic === "Ohm's law" ? "blank" : topic === "Resistors in series" ? "reworded" : true));
    await markExamJob({ examId });
    const sent = spy.mock.calls.flatMap((c) => c[0]);
    spy.mockRestore();
    expect(sent.length).toBeGreaterThan(0);
    expect(sent.every((a) => a.given.startsWith("my idea is"))).toBe(true); // only the reworded ones
    const ms = await db.select().from(marks).innerJoin(questions, eq(questions.id, marks.questionId)).where(eq(marks.examId, examId));
    const blankShort = ms.filter((m) => m.questions.type === "short" && m.marks.markedBy === "rule" && m.marks.verdict === "missed");
    expect(blankShort.length).toBeGreaterThan(0);
  });

  it("stops the track when the goal is reached, and writes no next exam", async () => {
    const { student, trackId, examId } = await family();
    await db.update(tracks).set({ goalThreshold: 8, goalRunLength: 1 }).where(eq(tracks.id, trackId));
    await takeExam(student.id, examId, () => true);
    const writeJobs = async () => (await db.select().from(jobs).where(eq(jobs.type, "write_exam"))).filter((j) => (j.payload as { trackId: string }).trackId === trackId).length;
    const before = await writeJobs();
    await markExamJob({ examId });
    expect(await writeJobs()).toBe(before); // no next exam requested
    const [t] = await db.select().from(tracks).where(eq(tracks.id, trackId));
    expect(t).toMatchObject({ status: "goal_reached", goalProgress: 1, nextExam: "none" });
  });

  it("0.2: a full score run with an untested topic keeps the track going, and the result names the topic", async () => {
    const { student, trackId, examId } = await family();
    await db.update(tracks).set({ goalThreshold: 8, goalRunLength: 1 }).where(eq(tracks.id, trackId));
    // A topic this exam doesn't ask about: still untested after a perfect paper.
    await db.insert(topics).values({ trackId, name: "Electric power", description: "", position: 99 });
    await takeExam(student.id, examId, () => true);
    await markExamJob({ examId });
    const [t] = await db.select().from(tracks).where(eq(tracks.id, trackId));
    expect(t).toMatchObject({ status: "active", goalProgress: 1, nextExam: "writing" });
    const result = await getResult(student.id, examId);
    expect(result?.goalReached).toBe(false);
    expect(result?.nextFocus).toMatch(/^You've met the score part of the goal\. The track finishes once this topic is strong too: Electric power\./);
  });

  it("never opens a second exam in a track", async () => {
    const { trackId } = await family();
    await writeExamJob({ trackId }, ctx); // exam 1 is still ready
    expect(await db.select().from(exams).where(eq(exams.trackId, trackId))).toHaveLength(1);
  });
});

describe("points over several days (rules §8)", () => {
  it("adds the streak bonus on the next day's first exam and improvement within a track", async () => {
    const { student, trackId, examId } = await family();
    // Day 1: a wrong topic, so 10 − (parallel questions) correct.
    await takeExam(student.id, examId, (topic) => topic !== "Resistors in parallel");
    await db.update(exams).set({ submittedAt: new Date("2030-03-01T09:00:00Z") }).where(eq(exams.id, examId));
    await markExamJob({ examId });
    const day1 = await db.select().from(pointsEvents).where(eq(pointsEvents.examId, examId));
    const correct1 = (await db.select().from(marks).where(and(eq(marks.examId, examId), eq(marks.verdict, "correct")))).length;
    expect(day1.map((p) => p.kind).sort()).toEqual(["correct", "finish"]);

    // Day 2: everything right → finish, correct, improvement, perfect, streak (day 2 → 5).
    await writeExamJob({ trackId }, ctx);
    const [exam2] = await db.select().from(exams).where(and(eq(exams.trackId, trackId), eq(exams.number, 2)));
    await takeExam(student.id, exam2!.id, () => true);
    await db.update(exams).set({ submittedAt: new Date("2030-03-02T09:00:00Z") }).where(eq(exams.id, exam2!.id));
    await markExamJob({ examId: exam2!.id });
    const day2 = Object.fromEntries((await db.select().from(pointsEvents).where(eq(pointsEvents.examId, exam2!.id))).map((p) => [p.kind, p.points]));
    expect(day2).toMatchObject({ finish: 10, correct: 20, improvement: (10 - correct1) * 5, perfect: 10, streak: 5 });
  });
});
