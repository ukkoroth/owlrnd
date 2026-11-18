import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { holderRef } from "@/domain/accounts";
import { formatClass } from "@/domain/identity";
import { awaitingRewording, poolWritePlan, type PoolRow } from "@/domain/questionPool";
import { rules } from "@/config/rules";
import { ai } from "./ai";
import { allowanceOf, budgetLeft, withAiContext } from "./ai/usage";
import { learnerConsent } from "./consent";
import { db } from "./db";
import { examQuestions, exams, flashcards, marks, questions, topics, tracks } from "./db/schema";
import { trackMaterial } from "./examWriter";
import { enqueue } from "./jobs/queue";
import { loadLearner } from "./learners";
import { topicStrengths } from "./progress";

/**
 * The question pool (roadmap 23, owner 2026-11-18; domain/questionPool.ts). The pool is the track's own question
 * rows: each is either unused, or on an exam (and maybe missed, and maybe reworded since).
 */
export async function loadPool(trackId: string) {
  const tps = await db.select().from(topics).where(eq(topics.trackId, trackId)).orderBy(asc(topics.position));
  const keyOf = new Map(tps.map((t, i) => [t.id, `T${i + 1}`]));
  const q = questions;
  const rows = await db
    .select({
      q,
      used: sql<boolean>`exists (select 1 from ${examQuestions} eq where eq.question_id = ${q.id})`,
      missed: sql<boolean>`exists (select 1 from ${marks} m where m.question_id = ${q.id} and m.verdict = 'missed')`,
      reworded: sql<boolean>`exists (select 1 from ${questions} v where v.variant_of = ${q.id})`,
    })
    .from(q)
    .where(eq(q.trackId, trackId))
    .orderBy(asc(q.createdAt));
  const pool: PoolRow[] = rows.map(({ q: r, used, missed, reworded }) => ({
    id: r.id,
    topicKey: keyOf.get(r.topicId) ?? "",
    type: r.type,
    prompt: r.prompt,
    options: r.options,
    correctIndex: r.correctOption,
    expectedAnswer: r.expectedAnswer,
    explanation: r.explanation,
    difficulty: r.difficulty,
    group: r.variantOf ?? r.id,
    used,
    missed,
    reworded,
  }));

  // The ideas on the latest exams, newest first: a rewording waits until its idea is out of this window.
  const recent = await db
    .select({ id: exams.id })
    .from(exams)
    .where(eq(exams.trackId, trackId))
    .orderBy(desc(exams.number))
    .limit(rules.exam.repeatWindowExams);
  const onRecent = recent.length
    ? await db
        .select({ examId: examQuestions.examId, group: sql<string>`coalesce(${questions.variantOf}, ${questions.id})` })
        .from(examQuestions)
        .innerJoin(questions, eq(questions.id, examQuestions.questionId))
        .where(inArray(examQuestions.examId, recent.map((e) => e.id)))
    : [];
  const recentGroups = recent.map((e) => onRecent.filter((r) => r.examId === e.id).map((r) => r.group));
  return { pool, recentGroups, topicKeys: tps.map((_, i) => `T${i + 1}`) };
}

export type PoolWriteResult = { written: number } | { skipped: string } | { postponed: "budget" | "allowance" | "consent" };

/**
 * One AI call adds to the pool: new wordings of missed questions waiting for one, then about `size` new questions
 * spread by the exam mix (domain/questionPool.poolWritePlan). The caller has checked the limits when it must (an
 * exam waiting on it); the background job checks them itself.
 */
export async function writePool(trackId: string, size: number = rules.pool.examsAhead * rules.exam.maxQuestions): Promise<PoolWriteResult> {
  const [track] = await db.select().from(tracks).where(eq(tracks.id, trackId));
  if (!track || track.status === "draft" || track.status === "archived" || track.sampleKey) return { skipped: "no pool for this track" };
  const learner = await loadLearner(track.studentId);
  if (!learner) return { skipped: "no learner" };
  const { student, holder } = learner;

  const tps = await db.select().from(topics).where(eq(topics.trackId, trackId)).orderBy(asc(topics.position));
  if (!tps.length) return { skipped: "no topics" };
  const keyed = tps.map((t, i) => ({ key: `T${i + 1}`, id: t.id, name: t.name, description: t.description, revisionOnly: t.revisionOnly }));
  const strengths = (await topicStrengths(student.id, [trackId])).get(trackId) ?? [];
  const mix = keyed.map((t) => ({ key: t.key, name: t.name, strength: strengths.find((s) => s.id === t.id)?.strength ?? ("not_tested" as const), revision: t.revisionOnly }));

  const { pool } = await loadPool(trackId);
  const waiting = awaitingRewording(pool);
  const plan = poolWritePlan(
    mix.filter((t) => !t.revision),
    mix.filter((t) => t.revision),
    waiting.map((w) => ({ topicKey: w.topicKey, type: w.type, prompt: w.prompt })),
    size,
  );
  if (!plan.length) return { written: 0 };

  const avoid = (await db.select({ prompt: questions.prompt }).from(questions).where(eq(questions.trackId, trackId)).orderBy(desc(questions.createdAt)).limit(rules.pool.avoidRecent)).map((r) => r.prompt);
  const deckFronts = (await db.select({ front: flashcards.front }).from(flashcards).where(eq(flashcards.trackId, trackId))).map((c) => c.front);
  const written = await withAiContext({ purpose: "write_pool", holder: holderRef(holder), studentId: student.id }, async () =>
    ai().writeQuestions({
      trackName: track.name ?? "",
      audience: student.type === "self_managed" ? "learner" : "parent",
      level: student.type === "self_managed" ? `a learner preparing on their own for the exam in "${track.name ?? ""}"` : formatClass(student.className),
      topics: keyed,
      focusNotes: track.focusNotes,
      material: await trackMaterial(trackId),
      plan,
      avoid,
      deckFronts,
      bank: true,
    }),
  );

  // A retry line's question is a new wording of that missed question (same position in the plan).
  const originalOf = (i: number) => (plan[i]?.retryOf ? waiting.find((w) => w.prompt === plan[i]!.retryOf)?.id ?? null : null);
  const rows = written.map((q, i) => ({
    trackId,
    topicId: keyed.find((t) => t.key === q.topicKey)!.id,
    type: q.type,
    prompt: q.prompt.trim(),
    options: q.type === "multiple_choice" ? q.options.map((o) => o.trim()) : [],
    correctOption: q.type === "multiple_choice" ? q.correctIndex : null,
    expectedAnswer: q.type === "short" ? q.expectedAnswer!.trim() : null,
    marks: q.type === "multiple_choice" ? rules.marks.multipleChoice : rules.marks.short,
    difficulty: q.difficulty,
    explanation: q.explanation.trim(),
    variantOf: originalOf(i),
  }));
  await db.insert(questions).values(rows);
  return { written: rows.length };
}

/** Job "write_pool": a background top-up. Waits for the budget, the allowance and consent like flashcards do. */
export async function writePoolJob(payload: unknown) {
  const { trackId } = payload as { trackId: string };
  const [track] = await db.select().from(tracks).where(eq(tracks.id, trackId));
  if (!track || track.status === "draft" || track.status === "archived" || track.sampleKey) return;
  const learner = await loadLearner(track.studentId);
  if (!learner) return;
  let postponed: "budget" | "allowance" | "consent" | null = null;
  if (!(await budgetLeft())) postponed = "budget";
  else if ((await allowanceOf(learner.holder)).usedUp) postponed = "allowance";
  else if (!(await learnerConsent(learner.student)).practiseAllowed) postponed = "consent";
  if (postponed) {
    const retryAt = new Date(Date.now() + (postponed === "consent" ? 6 * 60 : rules.aiLimits.budgetRetryMinutes) * 60_000);
    await enqueue("write_pool", payload, { runAt: retryAt });
    console.info(`[owlrnd pool] top-up for track ${trackId} postponed (${postponed}) until ${retryAt.toISOString()}`);
    return;
  }
  await writePool(trackId);
}

/** Questions on a track that have never been on an exam (for tests and the top-up check). */
export async function unusedCount(trackId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(questions)
    .where(and(eq(questions.trackId, trackId), sql`not exists (select 1 from ${examQuestions} eq where eq.question_id = ${questions.id})`));
  return row?.n ?? 0;
}
