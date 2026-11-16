import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { suggestExams } from "@/domain/suggestions";
import { todayIn } from "@/domain/tracks";
import { db } from "./db";
import { enqueue } from "./jobs/queue";
import { topicStrengths, type TopicWithStrength } from "./progress";
import { recentScores } from "./results";
import { answers, examQuestions, exams, questions, students, topics, tracks } from "./db/schema";

export type StudentTrack = {
  id: string;
  name: string;
  status: "active" | "paused" | "goal_reached" | "archived";
  testDate: string | null;
  testLabel: string | null;
  goalThreshold: number;
  goalRunLength: number;
  goalProgress: number;
  topicNames: string[];
  topics: TopicWithStrength[];
  /** Latest marked scores, oldest first. */
  scores: number[];
  examsTaken: number;
  lastPracticedAt: Date | null;
  weakTopics: number;
  /** The track's colour (domain/trackColors.ts). */
  colorIndex: number;
  /** The next exam is being written in the background (a running track with no exam waiting, not failed). */
  preparing: boolean;
  /** The next exam to take (ready) or to continue (in progress). overallNumber is set once it has started. */
  exam: { id: string; number: number; status: "ready" | "in_progress"; questionCount: number; overallNumber: number | null } | null;
};

/** Everything the student's dashboard (3c–3g) and Your tracks (4.1a) need. Archived tracks are hidden (rules §2). */
export async function getStudentTracks(studentId: string): Promise<StudentTrack[]> {
  const rows = await db
    .select()
    .from(tracks)
    .where(and(eq(tracks.studentId, studentId), ne(tracks.status, "draft"), ne(tracks.status, "archived")))
    .orderBy(asc(tracks.activatedAt));
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const tps = await db.select().from(topics).where(inArray(topics.trackId, ids)).orderBy(asc(topics.position));
  const strengths = await topicStrengths(studentId, ids);
  const scores = await recentScores(ids);
  const exs = await db
    .select({
      id: exams.id,
      trackId: exams.trackId,
      number: exams.number,
      overallNumber: exams.overallNumber,
      status: exams.status,
      submittedAt: exams.submittedAt,
      questionCount: sql<number>`(select count(*)::int from ${examQuestions} where ${examQuestions.examId} = ${exams.id})`,
    })
    .from(exams)
    .where(inArray(exams.trackId, ids))
    .orderBy(asc(exams.number));

  return rows.map((t) => {
    const mine = exs.filter((e) => e.trackId === t.id);
    const open = mine.find((e) => e.status === "in_progress") ?? mine.find((e) => e.status === "ready");
    const done = mine.filter((e) => e.submittedAt);
    const ts = strengths.get(t.id) ?? [];
    return {
      id: t.id,
      name: t.name ?? "",
      status: t.status as StudentTrack["status"],
      testDate: t.testDate,
      testLabel: t.testLabel,
      goalThreshold: t.goalThreshold ?? 8,
      goalRunLength: t.goalRunLength ?? 3,
      goalProgress: t.goalProgress,
      topicNames: tps.filter((x) => x.trackId === t.id).map((x) => x.name),
      topics: ts,
      scores: scores.get(t.id) ?? [],
      examsTaken: done.length,
      lastPracticedAt: done.length ? done[done.length - 1]!.submittedAt : null,
      weakTopics: ts.filter((x) => x.strength === "needs_work").length,
      colorIndex: t.colorIndex,
      preparing: t.status === "active" && !open && t.nextExam !== "failed",
      exam: open
        ? { id: open.id, number: open.number, status: open.status as "ready" | "in_progress", questionCount: open.questionCount, overallNumber: open.overallNumber }
        : null,
    };
  });
}

export type RecentExam = {
  id: string;
  number: number;
  overallNumber: number | null;
  trackName: string;
  colorIndex: number;
  status: string;
  submittedAt: Date;
  score: number | null;
};

export async function recentExams(studentId: string, limit = 30): Promise<RecentExam[]> {
  // Columns selected directly (not through sql``) so drizzle maps timestamps to Date objects.
  const rows = await db
    .select({
      id: exams.id,
      number: exams.number,
      overallNumber: exams.overallNumber,
      trackName: tracks.name,
      colorIndex: tracks.colorIndex,
      status: exams.status,
      submittedAt: exams.submittedAt,
      score: exams.score,
    })
    .from(exams)
    .innerJoin(tracks, eq(tracks.id, exams.trackId))
    .where(and(eq(exams.studentId, studentId), isNotNull(exams.submittedAt)))
    .orderBy(desc(exams.submittedAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, trackName: r.trackName ?? "", submittedAt: r.submittedAt! }));
}

export async function getStudentDashboard(studentId: string) {
  const [student] = await db.select().from(students).where(eq(students.id, studentId));
  const list = await getStudentTracks(studentId);
  const recent = await recentExams(studentId);
  const today = todayIn(student!.timeZone);
  const suggestions = suggestExams(list, today);
  const [{ completed } = { completed: 0 }] = await db
    .select({ completed: sql<number>`count(*)::int` })
    .from(exams)
    .where(and(eq(exams.studentId, studentId), isNotNull(exams.submittedAt)));
  return {
    tracks: list,
    suggestions,
    /** Exams finished on owlrnd, all tracks (top right of the dashboard, owner 2026-11-16). */
    completed,
    recent,
    firstDay: recent.length === 0,
  };
}

// ── The paper (4.1b) ───────────────────────────────────────────────────────

export type PaperQuestion = {
  id: string;
  type: "multiple_choice" | "short";
  prompt: string;
  options: string[];
  marks: number;
};

export type Paper = {
  id: string;
  number: number;
  status: "ready" | "in_progress" | "submitted" | "marking" | "marked";
  trackName: string;
  questions: PaperQuestion[];
  answers: Record<string, { chosenOption: number | null; text: string | null }>;
  /** When each answer was last saved (ms), so the paper can keep a newer copy from the browser (0.2). */
  answerSavedAt: Record<string, number>;
};

/**
 * The exam as the student sees it. Deliberately selects no correct option, expected answer or explanation:
 * answers are never revealed before the exam is submitted (AI §6).
 */
export async function getPaper(studentId: string, examId: string): Promise<Paper | null> {
  if (!/^[0-9a-f-]{36}$/i.test(examId)) return null;
  const [exam] = await db
    .select({ id: exams.id, number: exams.number, status: exams.status, trackName: tracks.name })
    .from(exams)
    .innerJoin(tracks, eq(tracks.id, exams.trackId))
    .where(and(eq(exams.id, examId), eq(exams.studentId, studentId)));
  if (!exam) return null;
  const qs = await db
    .select({ id: questions.id, type: questions.type, prompt: questions.prompt, options: questions.options, marks: questions.marks })
    .from(examQuestions)
    .innerJoin(questions, eq(questions.id, examQuestions.questionId))
    .where(eq(examQuestions.examId, examId))
    .orderBy(asc(examQuestions.position));
  const ans = await db.select().from(answers).where(eq(answers.examId, examId));
  return {
    ...exam,
    trackName: exam.trackName ?? "",
    questions: qs,
    answers: Object.fromEntries(ans.map((a) => [a.questionId, { chosenOption: a.chosenOption, text: a.text }])),
    answerSavedAt: Object.fromEntries(ans.map((a) => [a.questionId, a.savedAt.getTime()])),
  };
}

/** Opening a ready exam starts it. Paused or finished tracks can't be started (rules §2, §3). */
export async function startExam(studentId: string, examId: string) {
  const [row] = await db
    .select({ status: exams.status, trackStatus: tracks.status })
    .from(exams)
    .innerJoin(tracks, eq(tracks.id, exams.trackId))
    .where(and(eq(exams.id, examId), eq(exams.studentId, studentId)));
  if (!row) return false;
  if (row.status === "ready") {
    if (row.trackStatus !== "active") return false;
    // Starting fixes the exam's overall number: the learner's nth exam on owlrnd (owner, 2026-11-16). One start at
    // a time per learner, so two exams can't get the same number.
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`overall:${studentId}`}))`);
      const [{ n } = { n: 0 }] = await tx
        .select({ n: sql<number>`coalesce(max(${exams.overallNumber}), 0)::int` })
        .from(exams)
        .where(eq(exams.studentId, studentId));
      await tx
        .update(exams)
        .set({ status: "in_progress", startedAt: new Date(), overallNumber: n + 1 })
        .where(and(eq(exams.id, examId), eq(exams.status, "ready")));
    });
  }
  return true;
}

export const MAX_ANSWER_LENGTH = 300;

/** Saved as the student works (rules §5). Only while the exam is in progress, only for its own questions. */
export async function saveAnswer(studentId: string, examId: string, questionId: string, value: { chosenOption: number | null; text: string | null }) {
  const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  if (!isUuid(examId) || !isUuid(questionId)) return false;
  const [ok] = await db
    .select({ type: questions.type, options: questions.options })
    .from(examQuestions)
    .innerJoin(exams, eq(exams.id, examQuestions.examId))
    .innerJoin(questions, eq(questions.id, examQuestions.questionId))
    .where(and(eq(examQuestions.examId, examId), eq(examQuestions.questionId, questionId), eq(exams.studentId, studentId), eq(exams.status, "in_progress")));
  if (!ok) return false;
  const chosen = ok.type === "multiple_choice" && value.chosenOption !== null && value.chosenOption >= 0 && value.chosenOption < ok.options.length ? value.chosenOption : null;
  const text = ok.type === "short" ? (value.text ?? "").slice(0, MAX_ANSWER_LENGTH) : null;
  const now = new Date();
  try {
    await db
      .insert(answers)
      .values({ examId, questionId, chosenOption: chosen, text, savedAt: now })
      .onConflictDoUpdate({ target: [answers.examId, answers.questionId], set: { chosenOption: chosen, text, savedAt: now } });
  } catch (err) {
    // The exam was deleted meanwhile (e.g. the parent removed the student): nothing to save into.
    const code = (err as { code?: string; cause?: { code?: string } }).cause?.code ?? (err as { code?: string }).code;
    if (code === "23503") return false;
    throw err;
  }
  return true;
}

/** Submit (idempotent). Blank answers count as wrong when marked (rules §5). */
export async function submitExam(studentId: string, examId: string) {
  const [exam] = await db
    .select({ status: exams.status })
    .from(exams)
    .where(and(eq(exams.id, examId), eq(exams.studentId, studentId)));
  if (!exam) return false;
  if (exam.status === "in_progress") {
    const moved = await db
      .update(exams)
      .set({ status: "marking", submittedAt: new Date() })
      .where(and(eq(exams.id, examId), eq(exams.status, "in_progress")))
      .returning({ id: exams.id });
    if (moved.length) await enqueue("mark_exam", { examId }); // rules §6: marking runs in the background
  }
  return exam.status !== "ready";
}
