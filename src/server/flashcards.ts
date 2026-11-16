import "server-only";
import { and, asc, count, eq, inArray, isNotNull } from "drizzle-orm";
import { rules } from "@/config/rules";
import { holderRef } from "@/domain/accounts";
import { planStarter, planTopUp, type CardSlot, type DeckTopic } from "@/domain/flashcards";
import { formatClass } from "@/domain/identity";
import { ai } from "./ai";
import { allowanceOf, budgetLeft, withAiContext } from "./ai/usage";
import { learnerConsent } from "./consent";
import { db } from "./db";
import { flashcards, marks, questions, topics, tracks } from "./db/schema";
import { trackMaterial } from "./examWriter";
import { enqueue } from "./jobs/queue";
import { loadLearner } from "./learners";
import { topicStrengths } from "./progress";

// 0.3 Flashcards, F1 (docs/plan-0.3-flashcards.md): writing a track's deck. A starter deck when a track is created
// or gets new topics; a card for each of up to 3 missed exam questions on topics that need work; a top-up when the
// learner practises and too few cards are due. Cards stay in the track (and so in one account).

export type DeckReason = "starter" | "missed" | "top_up";
export type WriteDeckResult = { written: number } | { postponed: "budget" | "allowance" | "consent" } | { skipped: string };

const F = rules.flashcards;

/** Write cards for a track now. Returns how many were saved, or why nothing was written. */
export async function writeDeck(trackId: string, reason: DeckReason, examId?: string): Promise<WriteDeckResult> {
  const [track] = await db.select().from(tracks).where(eq(tracks.id, trackId));
  if (!track || track.status === "draft" || track.status === "archived") return { skipped: "no live track" };
  const learner = await loadLearner(track.studentId);
  if (!learner) return { skipped: "no learner" };
  const { student, holder } = learner;

  // The same limits as exam writing: the month's budget, the account's AI allowance, and consent (M10).
  if (!(await budgetLeft())) return { postponed: "budget" };
  if ((await allowanceOf(holder)).usedUp) return { postponed: "allowance" };
  if (!(await learnerConsent(student)).practiseAllowed) return { postponed: "consent" };

  const tps = await db.select().from(topics).where(eq(topics.trackId, trackId)).orderBy(asc(topics.position));
  if (!tps.length) return { skipped: "no topics" };
  const keyed = tps.map((t, i) => ({ key: `T${i + 1}`, id: t.id, name: t.name, description: t.description, revision: t.revisionOnly }));
  const keyOf = (topicId: string) => keyed.find((k) => k.id === topicId)?.key;

  const existing = await db.select({ topicId: flashcards.topicId, front: flashcards.front, sourceQuestionId: flashcards.sourceQuestionId }).from(flashcards).where(eq(flashcards.trackId, trackId));
  const strengths = (await topicStrengths(student.id, [trackId])).get(trackId) ?? [];
  const deckTopics: DeckTopic[] = keyed.map((k) => ({
    key: k.key,
    strength: strengths.find((s) => s.id === k.id)?.strength ?? "not_tested",
    revision: k.revision,
    existing: existing.filter((e) => e.topicId === k.id).length,
  }));

  let plan: CardSlot[] = [];
  let missed: { key: string; topicKey: string; question: string; expected: string; explanation: string; questionId: string }[] = [];
  if (reason === "starter") plan = planStarter(deckTopics, existing.length);
  else if (reason === "top_up") plan = planTopUp(deckTopics, existing.length);
  else if (examId) {
    // Questions missed in this exam, on topics that still need work, not already made into cards.
    const done = new Set(existing.map((e) => e.sourceQuestionId).filter(Boolean));
    const rows = await db
      .select({ q: questions })
      .from(marks)
      .innerJoin(questions, eq(questions.id, marks.questionId))
      .where(and(eq(marks.examId, examId), eq(marks.verdict, "missed")));
    const room = Math.max(0, F.deckMax - existing.length);
    // At most `missedPerExam` cards per exam, even if the job runs again.
    const fromThisExam = rows.filter((r) => done.has(r.q.id)).length;
    missed = rows
      .map((r) => r.q)
      .filter((q) => !done.has(q.id) && deckTopics.find((t) => t.key === keyOf(q.topicId))?.strength === "needs_work")
      .slice(0, Math.min(Math.max(0, F.missedPerExam - fromThisExam), room))
      .map((q, i) => ({
        key: `M${i + 1}`,
        topicKey: keyOf(q.topicId)!,
        question: q.prompt,
        expected: q.type === "multiple_choice" ? (q.options[q.correctOption ?? 0] ?? "") : (q.expectedAnswer ?? ""),
        explanation: q.explanation,
        questionId: q.id,
      }));
  }
  if (!plan.length && !missed.length) return { written: 0 };

  const material = await trackMaterial(trackId);
  const written = await withAiContext({ purpose: "write_flashcards", holder: holderRef(holder), studentId: student.id }, () =>
    ai().writeFlashcards({
      audience: holder.kind === "parent" ? "parent" : "learner",
      trackName: track.name ?? "",
      level: student.type === "self_managed" ? `a learner preparing on their own for the exam in "${track.name ?? ""}"` : formatClass(student.className),
      topics: keyed.map((k) => ({ key: k.key, name: k.name, description: k.description })),
      material,
      plan,
      missed: missed.map((m) => ({ key: m.key, topicKey: m.topicKey, question: m.question, expected: m.expected, explanation: m.explanation })),
      knownFronts: existing.map((e) => e.front),
    }),
  );

  // Never past the deck's limit, even if two writes raced.
  const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(flashcards).where(eq(flashcards.trackId, trackId));
  const keep = written.slice(0, Math.max(0, F.deckMax - n));
  if (!keep.length) return { written: 0 };
  const now = new Date();
  const saved = await db
    .insert(flashcards)
    .values(
      keep.map((c) => {
        const m = c.missedKey ? missed.find((x) => x.key === c.missedKey) : undefined;
        return {
          trackId,
          topicId: keyed.find((k) => k.key === c.topicKey)!.id,
          front: c.front.trim(),
          answer: c.answer.trim(),
          explanation: c.explanation.trim(),
          source: m ? ("missed_question" as const) : ("material" as const),
          sourceQuestionId: m?.questionId ?? null,
          dueAt: now,
          createdAt: now,
        };
      }),
    )
    .onConflictDoNothing()
    .returning({ id: flashcards.id });
  return { written: saved.length };
}

/** Background job "write_flashcards": payload { trackId, reason, examId? }. Postponed (not failed) while limits apply. */
export async function writeFlashcardsJob(payload: unknown) {
  const { trackId, reason, examId } = payload as { trackId: string; reason: DeckReason; examId?: string };
  const res = await writeDeck(trackId, reason, examId);
  if ("postponed" in res) {
    const retryAt = new Date(Date.now() + (res.postponed === "consent" ? 6 * 60 : rules.aiLimits.budgetRetryMinutes) * 60_000);
    await enqueue("write_flashcards", payload, { runAt: retryAt });
    console.info(`[owlrnd flashcards] ${reason} cards for track ${trackId} postponed (${res.postponed}) until ${retryAt.toISOString()}`);
  }
}

/** For tests and the deck page (F3): a track's cards, oldest first. */
export async function deckOf(trackId: string) {
  return db.select().from(flashcards).where(eq(flashcards.trackId, trackId)).orderBy(asc(flashcards.createdAt), asc(flashcards.id));
}

/** How many cards a track has, and how many are due now (for buttons in F3). */
export async function deckCounts(trackIds: string[], now = new Date()) {
  const out = new Map<string, { total: number; due: number }>(trackIds.map((id) => [id, { total: 0, due: 0 }]));
  if (!trackIds.length) return out;
  const rows = await db.select({ trackId: flashcards.trackId, dueAt: flashcards.dueAt }).from(flashcards).where(and(inArray(flashcards.trackId, trackIds), isNotNull(flashcards.dueAt)));
  for (const r of rows) {
    const c = out.get(r.trackId)!;
    c.total++;
    if (r.dueAt <= now) c.due++;
  }
  return out;
}
