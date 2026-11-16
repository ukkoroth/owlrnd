import "server-only";
import { holderRef } from "@/domain/accounts";
import { loadLearner } from "./learners";
import { and, asc, desc, eq, gt, isNotNull, lt, ne, sql } from "drizzle-orm";
import { goalProgress, goalReached } from "@/domain/goals";
import { addDays, examPoints, streakDays } from "@/domain/points";
import { exactMatch, scoreOutOf10 } from "@/domain/scoring";
import { todayIn } from "@/domain/tracks";
import { ai, type AnswerToMark } from "./ai";
import { withAiContext } from "./ai/usage";
import { db } from "./db";
import { answers, examQuestions, exams, marks, pointsEvents, questions, students, topicResults, tracks } from "./db/schema";
import { enqueue } from "./jobs/queue";
import { topicStrengths } from "./progress";

type QuestionMark = { questionId: string; topicId: string; awarded: number; correct: boolean; reason: string | null; by: "rule" | "ai" };

/**
 * Job "mark_exam" (rules §6). Multiple choice and exact or blank short answers are marked by rule; the remaining
 * short answers go to the AI in one call. Then, in one transaction: marks, score, topic results, goal progress and
 * points (rules §3, §4, §8). Finally the next exam is requested if the track is still active. Idempotent.
 */
export async function markExamJob(payload: unknown) {
  const { examId } = payload as { examId: string };
  const [exam] = await db.select().from(exams).where(eq(exams.id, examId));
  if (!exam || exam.status !== "marking") return;

  const rows = await db
    .select({ q: questions, a: answers })
    .from(examQuestions)
    .innerJoin(questions, eq(questions.id, examQuestions.questionId))
    .leftJoin(answers, and(eq(answers.examId, examQuestions.examId), eq(answers.questionId, examQuestions.questionId)))
    .where(eq(examQuestions.examId, examId))
    .orderBy(asc(examQuestions.position));

  const result: QuestionMark[] = [];
  const toAi: (AnswerToMark & { questionId: string })[] = [];
  for (const { q, a } of rows) {
    const base = { questionId: q.id, topicId: q.topicId };
    if (q.type === "multiple_choice") {
      const correct = a?.chosenOption !== null && a?.chosenOption !== undefined && a.chosenOption === q.correctOption;
      result.push({ ...base, awarded: correct ? q.marks : 0, correct, reason: null, by: "rule" });
    } else {
      const given = (a?.text ?? "").trim();
      if (!given) result.push({ ...base, awarded: 0, correct: false, reason: null, by: "rule" }); // blank counts as wrong (§5)
      else if (exactMatch(q.expectedAnswer ?? "", given)) result.push({ ...base, awarded: q.marks, correct: true, reason: null, by: "rule" });
      else toAi.push({ questionId: q.id, key: `A${toAi.length + 1}`, question: q.prompt, expected: q.expectedAnswer ?? "", given });
    }
  }
  if (toAi.length) {
    // Never limited by the daily limits or the budget: a submitted exam is always marked.
    const learner = await loadLearner(exam.studentId);
    const marked = await withAiContext({ purpose: "mark_answers", holder: learner ? holderRef(learner.holder) : null, studentId: exam.studentId }, () =>
      ai().markAnswers(toAi.map(({ key, question, expected, given }) => ({ key, question, expected, given }))),
    );
    for (const m of marked) {
      const src = toAi.find((t) => t.key === m.key)!;
      const q = rows.find((r) => r.q.id === src.questionId)!.q;
      result.push({ questionId: q.id, topicId: q.topicId, awarded: m.correct ? q.marks : 0, correct: m.correct, reason: m.correct ? null : m.reason || null, by: "ai" });
    }
  }

  const awarded = result.reduce((s, r) => s + r.awarded, 0);
  const available = rows.reduce((s, r) => s + r.q.marks, 0);
  const score = scoreOutOf10(awarded, available);
  const correctCount = result.filter((r) => r.correct).length;

  let writeNext = false;
  await db.transaction(async (tx) => {
    // Lock the exam row: only one marking run may finish it.
    const locked = await tx.execute<{ status: string }>(sql`select status from exams where id = ${examId} for update`);
    if (locked.rows[0]?.status !== "marking") return;

    const [student] = await tx.select().from(students).where(eq(students.id, exam.studentId));
    const [track] = await tx.select().from(tracks).where(eq(tracks.id, exam.trackId));
    const before = (await topicStrengths(exam.studentId, [exam.trackId], tx)).get(exam.trackId) ?? [];

    await tx.insert(marks).values(result.map((r) => ({ examId, questionId: r.questionId, marksAwarded: r.awarded, verdict: r.correct ? ("correct" as const) : ("missed" as const), reason: r.reason, markedBy: r.by })));
    await tx.insert(topicResults).values(
      result.map((r) => ({ studentId: exam.studentId, topicId: r.topicId, examId, questionId: r.questionId, correct: r.correct, answeredAt: exam.submittedAt ?? new Date() })),
    );
    const after = (await topicStrengths(exam.studentId, [exam.trackId], tx)).get(exam.trackId) ?? [];
    const nowStrong = after.filter((t) => t.strength === "strong" && before.find((b) => b.id === t.id)?.strength === "needs_work").map((t) => t.name);

    // Points (rules §8): compared with the previous marked exam in this track; streak and daily cap in the student's time zone.
    const [prev] = await tx
      .select({ id: exams.id })
      .from(exams)
      .where(and(eq(exams.trackId, exam.trackId), eq(exams.status, "marked"), lt(exams.number, exam.number)))
      .orderBy(desc(exams.number))
      .limit(1);
    const previousCorrect = prev
      ? (await tx.select({ v: marks.verdict }).from(marks).where(eq(marks.examId, prev.id))).filter((m) => m.v === "correct").length
      : null;
    const submittedAt = exam.submittedAt ?? new Date();
    const tz = student!.timeZone;
    const day = todayIn(tz, submittedAt);
    const others = await tx
      .select({ at: exams.submittedAt })
      .from(exams)
      .where(and(eq(exams.studentId, exam.studentId), isNotNull(exams.submittedAt), ne(exams.id, examId)));
    const otherDays = others.map((o) => ({ day: todayIn(tz, o.at!), at: o.at! }));
    const practiceDays = new Set([day, ...otherDays.map((o) => o.day)]);
    const lines = examPoints({
      correct: correctCount,
      previousCorrect,
      topicsNowStrong: nowStrong,
      perfect: score === 10,
      examsEarlierToday: otherDays.filter((o) => o.day === day && o.at < submittedAt).length,
      practisedYesterday: practiceDays.has(addDays(day, -1)),
      streakDay: streakDays(practiceDays, day),
    });
    if (lines.length) {
      await tx.insert(pointsEvents).values(lines.map((l) => ({ studentId: exam.studentId, examId, kind: l.kind, points: l.points, label: l.label })));
    }

    await tx.update(exams).set({ status: "marked", score, markedAt: new Date() }).where(eq(exams.id, examId));

    // Goal (rules §3): consecutive qualifying scores in this track, newest backwards.
    // Only exams since the goal was last set count (a restarted track starts again at 0).
    const scores = await tx
      .select({ score: exams.score })
      .from(exams)
      .where(and(eq(exams.trackId, exam.trackId), eq(exams.status, "marked"), gt(exams.number, track!.goalSinceExam)))
      .orderBy(asc(exams.number));
    const progress = goalProgress(scores.map((s) => s.score ?? 0), track!.goalThreshold ?? 8);
    const reached = goalReached(progress, track!.goalRunLength ?? 3);
    writeNext = !reached && track!.status === "active";
    await tx
      .update(tracks)
      .set({
        goalProgress: progress,
        ...(reached && track!.status === "active" ? { status: "goal_reached" as const, goalReachedAt: new Date() } : {}),
        nextExam: writeNext ? "writing" : "none",
      })
      .where(eq(tracks.id, exam.trackId));
  });

  if (writeNext) await enqueue("write_exam", { trackId: exam.trackId });
}

/** For 4.1d: is the exam still being marked? */
export async function markingStatus(studentId: string, examId: string) {
  const [row] = await db
    .select({ status: exams.status })
    .from(exams)
    .where(and(eq(exams.id, examId), eq(exams.studentId, studentId)));
  return row?.status ?? null;
}

