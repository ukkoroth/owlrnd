import { and, eq, isNotNull, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanup, learnerActor, makeParent, makeStudent, makeTrackWithExam, parentActor } from "../../tests/db-helpers";
import { rules } from "@/config/rules";
import { db } from "./db";
import { examQuestions, exams, jobs, marks, parents, questions, topics, tracks } from "./db/schema";
import { planNextExam, writeExamJob } from "./examWriter";
import { getPaper, saveAnswer, startExam, submitExam } from "./exams";
import { markExamJob } from "./marking";
import { loadPool, unusedCount, writePoolJob } from "./questionPool";
import { archiveTrack, setQuestionMode } from "./trackUpdates";
import { createSampleTrack } from "./tracks";
import { canFill, poolCandidates } from "@/domain/questionPool";

// Question pool (roadmap 23, owner 2026-11-18). Fake AI.
beforeAll(() => {
  process.env.OWLRND_FAKE_AI = "1";
  process.env.STORAGE_DIR = "./storage/test";
});
afterAll(async () => {
  await db.delete(jobs).where(sql`${jobs.type} in ('write_exam', 'write_pool', 'write_flashcards', 'mark_exam')`);
  await cleanup();
});
const ctx = { attempt: 1, isLastAttempt: true };
const questionRows = async (trackId: string) => (await db.select({ id: questions.id }).from(questions).where(eq(questions.trackId, trackId))).length;
const poolJobsFor = async (trackId: string) =>
  (await db.select().from(jobs).where(and(eq(jobs.type, "write_pool"), eq(jobs.status, "queued")))).filter((j) => (j.payload as { trackId: string }).trackId === trackId);
const latestExam = async (trackId: string) => (await db.select().from(exams).where(eq(exams.trackId, trackId)).orderBy(sql`${exams.number} desc`).limit(1))[0]!;

/** Answers the paper (`rightUpTo`: the first n questions right, the rest wrong), submits and marks it. */
async function takeAndMark(studentId: string, examId: string, rightUpTo = 99) {
  await startExam(studentId, examId);
  const paper = (await getPaper(studentId, examId))!;
  for (const [i, q] of paper.questions.entries()) {
    const [full] = await db.select().from(questions).where(eq(questions.id, q.id));
    const right = i < rightUpTo;
    if (q.type === "multiple_choice") await saveAnswer(studentId, examId, q.id, { chosenOption: right ? full!.correctOption : 3, text: null });
    else await saveAnswer(studentId, examId, q.id, { chosenOption: null, text: right ? full!.expectedAnswer : "no idea" });
  }
  await submitExam(studentId, examId);
  await markExamJob({ examId });
}

async function freshTrack() {
  const parent = await makeParent();
  const student = await makeStudent(parent.id);
  const { trackId, examId } = await makeTrackWithExam(parent.id, student.id);
  return { parent, student, trackId, examId };
}

describe("question pool (roadmap 23)", () => {
  it("writes exam 1 on its own; once it's marked, exam 2 is written into the pool, a top-up stocks it, and later exams are picked with no writing", async () => {
    const { student, trackId, examId } = await freshTrack();
    expect(await questionRows(trackId)).toBe(10); // exam 1 only
    expect(await poolJobsFor(trackId)).toHaveLength(0); // nothing written ahead for a learner who may not come back

    await takeAndMark(student.id, examId);
    await writeExamJob({ trackId }, ctx); // exam 2: only its own questions while the learner waits
    const second = await latestExam(trackId);
    expect(second).toMatchObject({ number: 2, status: "ready" });
    expect(await questionRows(trackId)).toBe(20);
    expect(await poolJobsFor(trackId)).not.toHaveLength(0);
    await writePoolJob({ trackId }); // the background top-up: about two exams' worth in stock
    expect(await unusedCount(trackId)).toBe(rules.pool.examsAhead * rules.exam.maxQuestions);
    await db.delete(jobs).where(and(eq(jobs.type, "write_pool"), eq(jobs.status, "queued")));

    await takeAndMark(student.id, second.id);
    const before = await questionRows(trackId);
    await writeExamJob({ trackId }, ctx);
    const third = await latestExam(trackId);
    expect(third).toMatchObject({ number: 3, status: "ready" });
    expect(await questionRows(trackId)).toBe(before); // picked, not written
    const onThird = await db.select().from(examQuestions).where(eq(examQuestions.examId, third.id));
    expect(onThird).toHaveLength(10);
    // None of the earlier exams' questions again.
    const earlier = new Set((await db.select().from(examQuestions).where(sql`${examQuestions.examId} in (${examId}, ${second.id})`)).map((r) => r.questionId));
    expect(onThird.filter((r) => earlier.has(r.questionId))).toEqual([]);
  });

  it("brings a missed question back only in new words, and not within 3 exams; right answers never return", async () => {
    const { student, trackId, examId } = await freshTrack();
    await writePoolJob({ trackId });
    await takeAndMark(student.id, examId, 7); // 3 missed
    const missedIds = (await db.select({ id: marks.questionId }).from(marks).where(and(eq(marks.examId, examId), eq(marks.verdict, "missed")))).map((m) => m.id);
    expect(missedIds).toHaveLength(3);

    await writePoolJob({ trackId }); // the top-up rewords the misses
    const variants = await db.select().from(questions).where(and(eq(questions.trackId, trackId), isNotNull(questions.variantOf)));
    expect(variants.map((v) => v.variantOf).sort()).toEqual([...missedIds].sort());
    const originals = await db.select().from(questions).where(eq(questions.trackId, trackId));
    for (const v of variants) expect(v.prompt).not.toBe(originals.find((o) => o.id === v.variantOf)!.prompt);

    // Exam 1's ideas are in the repeat window: no rewording is offered yet, and no exam-1 question at all.
    const { pool, recentGroups, topicKeys } = await loadPool(trackId);
    const offered = new Set(poolCandidates(pool, recentGroups, topicKeys).map((c) => c.id));
    for (const v of variants) expect(offered.has(v.id)).toBe(false);
    for (const o of originals.filter((q) => pool.find((p) => p.id === q.id)?.used)) expect(offered.has(o.id)).toBe(false);

    // Three more exams later, the rewordings can come back (the window has moved past exam 1).
    for (let i = 0; i < 3; i++) {
      await writeExamJob({ trackId }, ctx);
      await takeAndMark(student.id, (await latestExam(trackId)).id);
      await writePoolJob({ trackId });
    }
    const later = await loadPool(trackId);
    const nowOffered = new Set(poolCandidates(later.pool, later.recentGroups, later.topicKeys).map((c) => c.id));
    const usedOrOffered = variants.filter((v) => nowOffered.has(v.id) || later.pool.find((p) => p.id === v.id)?.used);
    expect(usedOrOffered.length).toBe(variants.length);
  });

  it("makes the exam at once when a topic is short but the pool has enough overall, and tops up in the background", async () => {
    const { student, trackId, examId } = await freshTrack();
    await takeAndMark(student.id, examId, 5);
    await writeExamJob({ trackId }, ctx);
    await writePoolJob({ trackId });
    await takeAndMark(student.id, (await latestExam(trackId)).id, 5);

    // Every topic but the first runs out of unused questions; the first keeps enough for a whole paper.
    const tps = await db.select().from(topics).where(eq(topics.trackId, trackId)).orderBy(topics.position);
    const unusedOn = (topicId: string) =>
      db.select({ id: questions.id }).from(questions).where(and(eq(questions.trackId, trackId), eq(questions.topicId, topicId), sql`not exists (select 1 from ${examQuestions} eq where eq.question_id = ${questions.id})`));
    for (const t of tps.slice(1)) for (const q of await unusedOn(t.id)) await db.delete(questions).where(eq(questions.id, q.id));
    const firstTopic = await unusedOn(tps[0]!.id);
    for (let i = 0; firstTopic.length + i < 10; i++) {
      const [copy] = await db.select().from(questions).where(eq(questions.id, firstTopic[0]!.id));
      await db.insert(questions).values({ ...copy!, id: undefined, createdAt: undefined, prompt: `${copy!.prompt} (${i})` });
    }
    const keyed = tps.map((t, i) => ({ key: `T${i + 1}`, id: t.id, name: t.name }));
    const { plan } = await planNextExam(trackId, student.id, keyed);
    const { pool, recentGroups, topicKeys } = await loadPool(trackId);
    const candidates = poolCandidates(pool, recentGroups, topicKeys);
    expect(candidates.length).toBeGreaterThanOrEqual(plan.length);
    expect(canFill(plan, candidates, topicKeys)).toBe(false);

    const before = await questionRows(trackId);
    await writeExamJob({ trackId }, ctx);
    expect(await latestExam(trackId)).toMatchObject({ number: 3, status: "ready" });
    expect(await questionRows(trackId)).toBe(before); // nothing written while the learner waits
    expect(await poolJobsFor(trackId)).not.toHaveLength(0); // the short topic is written in the background
  });

  it("keeps making exams from the pool when the AI allowance is used up, and holds only when the pool runs dry", async () => {
    const { parent, student, trackId, examId } = await freshTrack();
    await writePoolJob({ trackId });
    await db.update(parents).set({ aiLimitUsd: 0 }).where(eq(parents.id, parent.id));

    await takeAndMark(student.id, examId);
    await writeExamJob({ trackId }, ctx);
    expect(await latestExam(trackId)).toMatchObject({ number: 2, status: "ready" });

    // A background top-up waits for the allowance instead of writing.
    const before = await questionRows(trackId);
    await writePoolJob({ trackId });
    expect(await questionRows(trackId)).toBe(before);

    // Use up the rest of the pool: the next exam is held for the allowance, as before the pool existed.
    await takeAndMark(student.id, (await latestExam(trackId)).id);
    await writeExamJob({ trackId }, ctx);
    await takeAndMark(student.id, (await latestExam(trackId)).id);
    await writeExamJob({ trackId }, ctx);
    const [t] = await db.select().from(tracks).where(eq(tracks.id, trackId));
    expect(t!.nextExamHold).toBe("allowance");
    expect((await latestExam(trackId)).number).toBe(3);
  });

  it("writes nothing for an archived track (its discarded exam's questions go back into the pool)", async () => {
    const { parent, trackId } = await freshTrack();
    await archiveTrack(parentActor(parent.id), trackId);
    await writePoolJob({ trackId });
    expect(await questionRows(trackId)).toBe(10);
    expect(await unusedCount(trackId)).toBe(10);
  });

  it("a track set to fresh writes every exam with the AI and never touches the pool; switching back uses the pool again", async () => {
    const { parent, student, trackId, examId } = await freshTrack();
    expect(await setQuestionMode(parentActor(parent.id), trackId, "fresh")).toBe(true);

    await takeAndMark(student.id, examId, 7);
    await writeExamJob({ trackId }, ctx);
    expect(await questionRows(trackId)).toBe(20); // exam 2 written on its own, no batch
    expect(await poolJobsFor(trackId)).toHaveLength(0);
    await writePoolJob({ trackId }); // a stray job does nothing
    expect(await questionRows(trackId)).toBe(20);

    expect(await setQuestionMode(parentActor(parent.id), trackId, "pool")).toBe(true);
    await takeAndMark(student.id, (await latestExam(trackId)).id);
    await writeExamJob({ trackId }, ctx);
    expect(await questionRows(trackId)).toBe(20 + 10); // exam 3's questions written into the pool and picked from it
    expect((await latestExam(trackId)).number).toBe(3);
    expect(await poolJobsFor(trackId)).not.toHaveLength(0); // the rest of the stock comes in the background
  });

  it("only whoever controls the track can change it, and never on a sample track", async () => {
    const { parent, student, trackId } = await freshTrack();
    expect(await setQuestionMode(parentActor((await makeParent()).id), trackId, "fresh")).toBe(false);
    expect(await setQuestionMode(learnerActor(student), trackId, "fresh")).toBe(false);
    const [t] = await db.select().from(tracks).where(eq(tracks.id, trackId));
    expect(t!.questionMode).toBe("pool");

    const sample = await createSampleTrack(parentActor(parent.id), student.id);
    if (!sample.ok) throw new Error(sample.error);
    expect(await setQuestionMode(parentActor(parent.id), sample.trackId, "fresh")).toBe(false);
  });
});
