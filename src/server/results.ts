import "server-only";
import { coverageMet } from "@/domain/goals";
import { and, asc, count, desc, eq, inArray, isNotNull, sum } from "drizzle-orm";
import { nextExamFocus, nextExamPlan } from "@/domain/examMix";
import { examTopicSummary } from "@/domain/topicStrength";
import type { ScoredExam } from "@/domain/activity";
import { db } from "./db";
import { answers, examQuestions, exams, marks, pointsEvents, questions, students, topics, tracks } from "./db/schema";
import { topicStrengths } from "./progress";

/** Total points (rules §8: the sum of points events; never decreases). */
export async function pointsTotal(studentId: string): Promise<number> {
  const [row] = await db.select({ total: sum(pointsEvents.points) }).from(pointsEvents).where(eq(pointsEvents.studentId, studentId));
  return Number(row?.total ?? 0);
}

/** Per-topic right/total for one marked exam, in track order. */
async function examTallies(examId: string) {
  const rows = await db
    .select({ topicId: topics.id, name: topics.name, position: topics.position, verdict: marks.verdict })
    .from(marks)
    .innerJoin(questions, eq(questions.id, marks.questionId))
    .innerJoin(topics, eq(topics.id, questions.topicId))
    .where(eq(marks.examId, examId))
    .orderBy(asc(topics.position));
  return examTopicSummary(rows.map((r) => ({ topicId: r.topicId, name: r.name, correct: r.verdict === "correct" })));
}

/** Everything 4.1e shows. Null unless the exam is the student's own and marked. */
export async function getResult(studentId: string, examId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(examId)) return null;
  const [row] = await db
    .select({ exam: exams, track: tracks })
    .from(exams)
    .innerJoin(tracks, eq(tracks.id, exams.trackId))
    .where(and(eq(exams.id, examId), eq(exams.studentId, studentId)));
  if (!row || row.exam.status !== "marked") return null;
  const { exam, track } = row;

  const kindOrder = ["finish", "correct", "improvement", "topic_strong", "perfect", "streak"];
  const points = (await db.select().from(pointsEvents).where(eq(pointsEvents.examId, examId))).sort((a, b) => kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind));
  const [{ n: questionCount } = { n: 0 }] = await db.select({ n: count() }).from(examQuestions).where(eq(examQuestions.examId, examId));
  const [{ n: right } = { n: 0 }] = await db.select({ n: count() }).from(marks).where(and(eq(marks.examId, examId), eq(marks.verdict, "correct")));
  const summary = await examTallies(examId);

  // What the next exam will focus on, from the same rules the exam writer uses (rules §4).
  const strengths = (await topicStrengths(studentId, [track.id])).get(track.id) ?? [];
  const goalReachedNow = track.status === "goal_reached";
  let nextFocus: string | null = null;
  if (!goalReachedNow) {
    const mix = strengths.map((t, i) => ({ key: `T${i + 1}`, name: t.name, strength: t.strength }));
    nextFocus = nextExamFocus(exam.number + 1, nextExamPlan(mix), mix);
    // 0.2 (rules §3): the score run is done but some topics aren't strong yet, so the track keeps going for them.
    const toStrengthen = strengths.filter((t) => !t.revisionOnly && t.strength !== "strong").map((t) => t.name);
    if (track.goalProgress >= (track.goalRunLength ?? 3) && toStrengthen.length && !coverageMet(strengths)) {
      nextFocus = `You've met the score part of the goal. The track finishes once ${toStrengthen.length === 1 ? "this topic is" : "these topics are"} strong too: ${toStrengthen.join(", ")}. ${nextFocus}`;
    }
  }
  const strongCount = strengths.filter((t) => t.strength === "strong").length;

  return {
    exam: { id: exam.id, number: exam.number, overallNumber: exam.overallNumber, score: exam.score ?? 0, submittedAt: exam.submittedAt! },
    track: { id: track.id, name: track.name ?? "", status: track.status, goalThreshold: track.goalThreshold ?? 8, goalRunLength: track.goalRunLength ?? 3, goalProgress: track.goalProgress },
    questionCount,
    right,
    points: points.map((p) => ({ label: p.label, points: p.points })),
    pointsEarned: points.reduce((s, p) => s + p.points, 0),
    strengths: summary.strengths,
    needsWork: summary.needsWork,
    nextFocus,
    goalReached: goalReachedNow,
    strongCount,
    topicCount: strengths.length,
  };
}

export type MarkedQuestion = {
  id: string;
  type: "multiple_choice" | "short";
  prompt: string;
  options: string[];
  correctOption: number | null;
  expectedAnswer: string | null;
  explanation: string;
  chosenOption: number | null;
  text: string | null;
  correct: boolean;
  reason: string | null;
};

/** 4.1f. Answers are shown only once the exam is marked (AI §6). */
export async function getMarkedPaper(studentId: string, examId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(examId)) return null;
  const [row] = await db
    .select({ exam: exams, trackName: tracks.name })
    .from(exams)
    .innerJoin(tracks, eq(tracks.id, exams.trackId))
    .where(and(eq(exams.id, examId), eq(exams.studentId, studentId)));
  if (!row || row.exam.status !== "marked") return null;
  const qs = await db
    .select({ q: questions, m: marks, a: answers })
    .from(examQuestions)
    .innerJoin(questions, eq(questions.id, examQuestions.questionId))
    .innerJoin(marks, and(eq(marks.examId, examQuestions.examId), eq(marks.questionId, examQuestions.questionId)))
    .leftJoin(answers, and(eq(answers.examId, examQuestions.examId), eq(answers.questionId, examQuestions.questionId)))
    .where(eq(examQuestions.examId, examId))
    .orderBy(asc(examQuestions.position));
  return {
    id: row.exam.id,
    number: row.exam.number,
    score: row.exam.score ?? 0,
    trackName: row.trackName ?? "",
    questions: qs.map(
      ({ q, m, a }): MarkedQuestion => ({
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        options: q.options,
        correctOption: q.correctOption,
        expectedAnswer: q.expectedAnswer,
        explanation: q.explanation,
        chosenOption: a?.chosenOption ?? null,
        text: a?.text ?? null,
        correct: m.verdict === "correct",
        reason: m.reason,
      }),
    ),
  };
}

/** Strong and needs-work topic names per marked exam (3d), keyed by exam id. */
export async function examTopicLines(examIds: string[]) {
  const out = new Map<string, { strong: string[]; needsWork: string[] }>();
  for (const id of examIds) {
    const s = await examTallies(id);
    out.set(id, { strong: s.strengths.map((t) => t.name), needsWork: s.needsWork.map((t) => t.name) });
  }
  return out;
}

/** Latest marked scores of a track, oldest first (score bars on track cards). */
export async function recentScores(trackIds: string[], perTrack = 5) {
  const out = new Map<string, number[]>(trackIds.map((id) => [id, []]));
  if (!trackIds.length) return out;
  const rows = await db
    .select({ trackId: exams.trackId, score: exams.score })
    .from(exams)
    .where(and(inArray(exams.trackId, trackIds), eq(exams.status, "marked")))
    .orderBy(desc(exams.number));
  for (const r of rows) {
    const list = out.get(r.trackId)!;
    if (list.length < perTrack) list.unshift(r.score ?? 0);
  }
  return out;
}

/** 2k: "Physics, 8 / 10 on 14 Nov" and the student's needs-work topics across tracks. */
export async function lastExamSummary(studentId: string) {
  const [last] = await db
    .select({ trackName: tracks.name, score: exams.score, markedAt: exams.markedAt, submittedAt: exams.submittedAt, tz: students.timeZone })
    .from(exams)
    .innerJoin(tracks, eq(tracks.id, exams.trackId))
    .innerJoin(students, eq(students.id, exams.studentId))
    .where(and(eq(exams.studentId, studentId), eq(exams.status, "marked")))
    .orderBy(desc(exams.submittedAt))
    .limit(1);
  if (!last) return null;
  const subject = (last.trackName ?? "").split(":")[0]!.trim();
  const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: last.tz }).format(last.submittedAt!);
  const trackIds = (await db.select({ id: tracks.id }).from(tracks).where(and(eq(tracks.studentId, studentId), inArray(tracks.status, ["active", "paused"])))).map((t) => t.id);
  const strengths = await topicStrengths(studentId, trackIds);
  const weak = [...strengths.values()].flat().filter((t) => t.strength === "needs_work").map((t) => t.name);
  return { line: `${subject}, ${last.score} / 10 on ${day}`, needsWork: weak.slice(0, 3).join(", ") };
}

/** Submitted-exam times for the activity charts (rules §9). */
export async function practiceTimes(studentId: string): Promise<Date[]> {
  const rows = await db.select({ at: exams.submittedAt }).from(exams).where(and(eq(exams.studentId, studentId), isNotNull(exams.submittedAt)));
  return rows.map((r) => r.at!);
}

/** 3d overall chart: the learner's latest marked exams across all tracks, oldest first. */
export async function examScores(studentId: string, limit = 50): Promise<ScoredExam[]> {
  const rows = await db
    .select({ id: exams.id, trackId: tracks.id, trackName: tracks.name, colorIndex: tracks.colorIndex, overallNumber: exams.overallNumber, score: exams.score, submittedAt: exams.submittedAt })
    .from(exams)
    .innerJoin(tracks, eq(tracks.id, exams.trackId))
    .where(and(eq(exams.studentId, studentId), eq(exams.status, "marked"), isNotNull(exams.score), isNotNull(exams.submittedAt)))
    .orderBy(desc(exams.submittedAt))
    .limit(limit);
  return rows.reverse().map((r) => ({ ...r, trackName: r.trackName ?? "Track", score: r.score!, submittedAt: r.submittedAt! }));
}

/** 4.3a: the student's points events. */
export async function pointsEventsOf(studentId: string) {
  return db.select().from(pointsEvents).where(eq(pointsEvents.studentId, studentId));
}
