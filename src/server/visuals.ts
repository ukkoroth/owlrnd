import "server-only";
import { and, asc, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { rules } from "@/config/rules";
import { holderRef } from "@/domain/accounts";
import { formatClass } from "@/domain/identity";
import { ai, type VisualItem } from "./ai";
import { allowanceOf, budgetLeft, withAiContext } from "./ai/usage";
import { learnerConsent } from "./consent";
import { db } from "./db";
import { flashcards, jobs, questions, tracks } from "./db/schema";
import { enqueue, trackJobPending } from "./jobs/queue";
import type { JobContext } from "./jobs/worker";
import { loadLearner } from "./learners";

/**
 * Pictures for questions and cards (docs/plan-wrong-answer-visuals.md, docs/07-ai.md §8). A background job draws
 * them in batches right after questions or cards are written, so writing an exam never waits for a picture.
 *
 * `visual_drawn_at`: null = still to do; the epoch = skipped (written before pictures existed, drawn only once an
 * exam or a practice session picks it, so the backlog isn't drawn all at once); any other time = done.
 */
export const VISUAL_SKIPPED = new Date(0);

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

/** Queue the picture job for a track, unless one is already waiting or running. */
export async function queueVisuals(trackId: string, tx: Executor = db) {
  if (!rules.visuals.enabled) return;
  if (await trackJobPending("draw_visuals", trackId, tx)) return;
  await enqueue("draw_visuals", { trackId }, { tx });
}

/** Old questions or cards just picked for an exam or a session: draw them now. Returns how many were waiting. */
export async function unskipVisuals(kind: "questions" | "flashcards", ids: string[], tx: Executor = db) {
  if (!ids.length) return 0;
  const table = kind === "questions" ? questions : flashcards;
  const rows = await tx
    .update(table)
    .set({ visualDrawnAt: null })
    .where(and(inArray(table.id, ids), eq(table.visualDrawnAt, VISUAL_SKIPPED)))
    .returning({ id: table.id });
  return rows.length;
}

const pendingQuestions = (trackId: string) => and(eq(questions.trackId, trackId), isNull(questions.visualDrawnAt));
/** Cards still to do, except those made from a question still to do: they take its picture once it's drawn. */
const pendingCards = (trackId: string) =>
  and(
    eq(flashcards.trackId, trackId),
    isNull(flashcards.visualDrawnAt),
    sql`not exists (select 1 from ${questions} q where q.id = ${flashcards.sourceQuestionId} and q.visual_drawn_at is null)`,
  );

export type DrawResult = { drawn: number; pictures: number } | { skipped: string } | { postponed: "budget" | "allowance" | "consent" };

/** One batch: copies pictures to cards made from drawn questions, then asks the AI about up to `batchMax` items. */
export async function drawBatch(trackId: string): Promise<DrawResult> {
  const [track] = await db.select().from(tracks).where(eq(tracks.id, trackId));
  if (!track || track.sampleKey || track.status === "draft" || track.status === "archived") return { skipped: "no pictures for this track" };
  const learner = await loadLearner(track.studentId);
  if (!learner) return { skipped: "no learner" };
  const { student, holder } = learner;

  // A card made from a missed question shows that question's picture: no AI needed.
  await db.execute(sql`
    update ${flashcards} f set visual = q.visual, visual_drawn_at = now()
    from ${questions} q
    where f.track_id = ${trackId} and f.visual_drawn_at is null and f.source_question_id = q.id
      and q.visual_drawn_at is not null and q.visual_drawn_at > 'epoch'`);

  const B = rules.visuals.batchMax;
  const qs = await db.select().from(questions).where(pendingQuestions(trackId)).orderBy(asc(questions.createdAt)).limit(B);
  const cards = qs.length < B ? await db.select().from(flashcards).where(pendingCards(trackId)).orderBy(asc(flashcards.createdAt)).limit(B - qs.length) : [];
  if (!qs.length && !cards.length) return { drawn: 0, pictures: 0 };

  if (!(await budgetLeft())) return { postponed: "budget" };
  if ((await allowanceOf(holder)).usedUp) return { postponed: "allowance" };
  if (!(await learnerConsent(student)).practiseAllowed) return { postponed: "consent" };

  const items: VisualItem[] = [
    ...qs.map((q, i) => ({
      key: `Q${i + 1}`,
      kind: "question" as const,
      prompt: q.prompt,
      options: q.options,
      answer: q.type === "multiple_choice" ? (q.options[q.correctOption ?? 0] ?? "") : (q.expectedAnswer ?? ""),
      explanation: q.explanation,
    })),
    ...cards.map((c, i) => ({ key: `C${i + 1}`, kind: "card" as const, prompt: c.front, options: [], answer: c.answer, explanation: c.explanation })),
  ];
  const drawn = await withAiContext({ purpose: "draw_visuals", holder: holderRef(holder), studentId: student.id }, () =>
    ai().drawVisuals({
      audience: holder.kind === "parent" ? "parent" : "learner",
      trackName: track.name ?? "",
      level: student.type === "self_managed" ? `a learner preparing on their own for the exam in "${track.name ?? ""}"` : formatClass(student.className),
      items,
    }),
  );

  const now = new Date();
  let pictures = 0;
  await db.transaction(async (tx) => {
    for (const [i, q] of qs.entries()) {
      const visual = drawn.get(`Q${i + 1}`) ?? null;
      if (visual) pictures++;
      await tx.update(questions).set({ visual, visualDrawnAt: now }).where(eq(questions.id, q.id));
    }
    for (const [i, c] of cards.entries()) {
      const visual = drawn.get(`C${i + 1}`) ?? null;
      if (visual) pictures++;
      await tx.update(flashcards).set({ visual, visualDrawnAt: now }).where(eq(flashcards.id, c.id));
    }
  });
  return { drawn: items.length, pictures };
}

async function remaining(trackId: string) {
  const [q] = await db.select({ n: count() }).from(questions).where(pendingQuestions(trackId));
  const [c] = await db.select({ n: count() }).from(flashcards).where(pendingCards(trackId));
  return (q?.n ?? 0) + (c?.n ?? 0);
}

/** Job "draw_visuals": payload { trackId }. One batch per run; queues itself again while items remain. */
export async function drawVisualsJob(payload: unknown, ctx: JobContext) {
  const { trackId } = payload as { trackId: string };
  let res: DrawResult;
  try {
    res = await drawBatch(trackId);
  } catch (err) {
    // A batch that keeps failing gets no pictures rather than being retried on every write.
    if (ctx.isLastAttempt) {
      const B = rules.visuals.batchMax;
      const qs = await db.select({ id: questions.id }).from(questions).where(pendingQuestions(trackId)).orderBy(asc(questions.createdAt)).limit(B);
      if (qs.length) await db.update(questions).set({ visualDrawnAt: new Date() }).where(inArray(questions.id, qs.map((q) => q.id)));
      else {
        const cs = await db.select({ id: flashcards.id }).from(flashcards).where(pendingCards(trackId)).orderBy(asc(flashcards.createdAt)).limit(B);
        if (cs.length) await db.update(flashcards).set({ visualDrawnAt: new Date() }).where(inArray(flashcards.id, cs.map((c) => c.id)));
      }
    }
    throw err;
  }
  if ("postponed" in res) {
    const retryAt = new Date(Date.now() + (res.postponed === "consent" ? 6 * 60 : rules.aiLimits.budgetRetryMinutes) * 60_000);
    await enqueue("draw_visuals", payload, { runAt: retryAt });
    console.info(`[owlrnd visuals] pictures for track ${trackId} postponed (${res.postponed}) until ${retryAt.toISOString()}`);
    return;
  }
  if ("drawn" in res && res.drawn > 0 && (await remaining(trackId)) > 0) {
    // This job still counts as running, so look only for another one already waiting.
    const [waiting] = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(and(eq(jobs.type, "draw_visuals"), eq(jobs.status, "queued"), sql`${jobs.payload}->>'trackId' = ${trackId}`))
      .limit(1);
    if (!waiting) await enqueue("draw_visuals", { trackId });
  }
}
