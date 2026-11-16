import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanup, makeParent, makeStudent, makeTrackWithExam, parentActor } from "../../tests/db-helpers";
import { db } from "./db";
import { examQuestions, exams, jobs, questions, topics, tracks } from "./db/schema";
import { writeExamJob } from "./examWriter";
import { getPaper, getStudentTracks, saveAnswer, startExam, submitExam } from "./exams";
import { markExamJob } from "./marking";
import { applyTrackUpdate, archiveTrack, examHistory, getUpdateChat, sendUpdateTurn } from "./trackUpdates";

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

async function takeAndMark(studentId: string, examId: string, allRight = true) {
  await startExam(studentId, examId);
  const paper = (await getPaper(studentId, examId))!;
  for (const q of paper.questions) {
    const [full] = await db.select().from(questions).where(eq(questions.id, q.id));
    if (q.type === "multiple_choice") await saveAnswer(studentId, examId, q.id, { chosenOption: allRight ? full!.correctOption : 3, text: null });
    else await saveAnswer(studentId, examId, q.id, { chosenOption: null, text: allRight ? full!.expectedAnswer : "no" });
  }
  await submitExam(studentId, examId);
  await markExamJob({ examId });
}

/** A track whose goal (8/10 once) is reached after one perfect exam. */
async function reachedTrack() {
  const parent = await makeParent();
  const student = await makeStudent(parent.id, { name: "Scout", timeZone: "UTC" });
  const { trackId, examId } = await makeTrackWithExam(parent.id, student.id);
  await db.update(tracks).set({ goalThreshold: 8, goalRunLength: 1 }).where(eq(tracks.id, trackId));
  await takeAndMark(student.id, examId);
  return { parent, student, trackId, examId };
}

describe("restarting a track (2j, rules §3)", () => {
  it("adds new topics, keeps earlier ones as revision, sets a new goal from 0, and the next exam has revision questions", async () => {
    const { parent, student, trackId } = await reachedTrack();
    const [before] = await db.select().from(tracks).where(eq(tracks.id, trackId));
    expect(before).toMatchObject({ status: "goal_reached", goalProgress: 1 });
    expect(before!.goalReachedAt).not.toBeNull();
    expect((await getStudentTracks(student.id))[0]!.exam).toBeNull(); // no Start for the student

    const chat = await getUpdateChat(parentActor(parent.id), trackId);
    expect(chat!.mode).toBe("restart");
    const t1 = await sendUpdateTurn(parentActor(parent.id), trackId, "Add chapter 13: magnetic field lines, electromagnets.", []);
    if (!t1.ok) throw new Error(t1.error);
    expect(t1.update).toMatchObject({ ready: false, goal: { threshold: 8, runLength: 3 } });
    expect(t1.update.newTopics.map((t) => t.name)).toEqual(["Magnetic field lines", "Electromagnets"]);
    expect(await applyTrackUpdate(parentActor(parent.id), trackId)).toEqual({ ok: false, error: "Agree the change in the chat first." });

    await sendUpdateTurn(parentActor(parent.id), trackId, "Yes, start it.", []);
    const applied = await applyTrackUpdate(parentActor(parent.id), trackId);
    expect(applied.ok).toBe(true);

    const [after] = await db.select().from(tracks).where(eq(tracks.id, trackId));
    expect(after).toMatchObject({ status: "active", goalProgress: 0, goalThreshold: 8, goalRunLength: 3, goalSinceExam: 1, goalReachedAt: null, nextExam: "writing" });
    const tps = await db.select().from(topics).where(eq(topics.trackId, trackId));
    expect(tps.filter((t) => t.revisionOnly).map((t) => t.name).sort()).toEqual(["Ohm's law", "Resistors in parallel", "Resistors in series"]);
    expect(tps.filter((t) => !t.revisionOnly).map((t) => t.name)).toEqual(["Magnetic field lines", "Electromagnets"]);

    await writeExamJob({ trackId }, ctx);
    const [exam2] = await db.select().from(exams).where(and(eq(exams.trackId, trackId), eq(exams.number, 2)));
    const qs = await db.select().from(examQuestions).innerJoin(questions, eq(questions.id, examQuestions.questionId)).where(eq(examQuestions.examId, exam2!.id));
    const revisionIds = new Set(tps.filter((t) => t.revisionOnly).map((t) => t.id));
    expect(qs.filter((q) => revisionIds.has(q.questions.topicId))).toHaveLength(2);

    // Old exams no longer count: a perfect exam 2 is progress 1 of 3, not 2.
    await takeAndMark(student.id, exam2!.id);
    expect((await db.select().from(tracks).where(eq(tracks.id, trackId)))[0]!.goalProgress).toBe(1);
  });
});

describe("adding material to an active track (owner decision, M6)", () => {
  it("adds topics and keeps the goal and its progress", async () => {
    const parent = await makeParent();
    const student = await makeStudent(parent.id);
    const { trackId, examId } = await makeTrackWithExam(parent.id, student.id);
    await takeAndMark(student.id, examId); // 10/10 → progress 1 of 3
    expect((await getUpdateChat(parentActor(parent.id), trackId))!.mode).toBe("add");
    await sendUpdateTurn(parentActor(parent.id), trackId, "Add chapter 13: electromagnets.", []);
    await sendUpdateTurn(parentActor(parent.id), trackId, "Yes please.", []);
    expect((await applyTrackUpdate(parentActor(parent.id), trackId)).ok).toBe(true);
    const [t] = await db.select().from(tracks).where(eq(tracks.id, trackId));
    expect(t).toMatchObject({ status: "active", goalProgress: 1, goalThreshold: 8, goalRunLength: 3, goalSinceExam: 0 });
    const tps = await db.select().from(topics).where(eq(topics.trackId, trackId));
    expect(tps.find((x) => x.name === "Electromagnets")).toMatchObject({ revisionOnly: false });
    expect(tps.some((x) => x.revisionOnly)).toBe(false);
  });

  it("changing the goal restarts progress at 0", async () => {
    const parent = await makeParent();
    const student = await makeStudent(parent.id);
    const { trackId, examId } = await makeTrackWithExam(parent.id, student.id);
    await takeAndMark(student.id, examId);
    await sendUpdateTurn(parentActor(parent.id), trackId, "Make the goal 9 / 10 in 2 exams in a row.", []);
    await sendUpdateTurn(parentActor(parent.id), trackId, "Yes.", []);
    expect((await applyTrackUpdate(parentActor(parent.id), trackId)).ok).toBe(true);
    const [t] = await db.select().from(tracks).where(eq(tracks.id, trackId));
    expect(t).toMatchObject({ goalProgress: 0, goalThreshold: 9, goalRunLength: 2, goalSinceExam: 1 });
  });
});

describe("archive and history", () => {
  it("archives only goal-reached tracks, hiding them from the student but keeping history", async () => {
    const { parent, student, trackId } = await reachedTrack();
    const other = await makeParent();
    expect(await archiveTrack(parentActor(other.id), trackId)).toBe(false);
    expect(await archiveTrack(parentActor(parent.id), trackId)).toBe(true);
    expect(await getStudentTracks(student.id)).toHaveLength(0);
    const hist = await examHistory(parentActor(parent.id), trackId);
    expect(hist!.exams).toHaveLength(1);
    expect(hist!.exams[0]).toMatchObject({ number: 1, score: 10 });
    expect(await examHistory(parentActor(other.id), trackId)).toBeNull();
  });

  it("won't archive an active track", async () => {
    const parent = await makeParent();
    const student = await makeStudent(parent.id);
    const { trackId } = await makeTrackWithExam(parent.id, student.id);
    expect(await archiveTrack(parentActor(parent.id), trackId)).toBe(false);
  });
});
