import "server-only";
import { and, asc, count, desc, eq, gt, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { rules } from "@/config/rules";
import { holderRef } from "@/domain/accounts";
import { cardState, dueAfter, nextBox, planStarter, planTopUp, practiseCount, PRACTISE_STATUSES, sessionPoints, type CardSlot, type CardState, type DeckTopic } from "@/domain/flashcards";
import { todayIn } from "@/domain/tracks";
import type { Actor } from "@/domain/permissions";
import { formatClass } from "@/domain/identity";
import { ai } from "./ai";
import { allowanceOf, budgetLeft, withAiContext } from "./ai/usage";
import { learnerConsent } from "./consent";
import { db } from "./db";
import { exams, flashcardReviews, flashcardSessions, flashcards, marks, pointsEvents, questions, students, topics, tracks } from "./db/schema";
import { trackMaterial } from "./examWriter";
import { enqueue } from "./jobs/queue";
import { authorizeTrack, loadLearner } from "./learners";
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
  const examQuestions = await recentExamQuestions(trackId);
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
      examQuestions,
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

/** The track's latest exam questions, for cards to avoid repeating (rules.flashcards.repeats). */
async function recentExamQuestions(trackId: string) {
  const rows = await db.select({ prompt: questions.prompt }).from(questions).where(eq(questions.trackId, trackId)).orderBy(desc(questions.createdAt)).limit(60);
  return rows.map((r) => r.prompt);
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
export type DeckCount = {
  total: number;
  due: number;
  known: number;
  /** The number for "Practise · N flashcards", or null when there's nothing to practise (practiseCount). */
  practise: number | null;
  /** When the learner last finished a session on the track. */
  lastAt: Date | null;
};

/** Per track: cards, cards due now, cards known, and the Practise button's count (fc-1, fc-5). */
export async function deckCounts(trackIds: string[], now = new Date()) {
  const out = new Map<string, DeckCount>(trackIds.map((id) => [id, { total: 0, due: 0, known: 0, practise: null, lastAt: null }]));
  if (!trackIds.length) return out;
  const rows = await db
    .select({ trackId: flashcards.trackId, dueAt: flashcards.dueAt, box: flashcards.box })
    .from(flashcards)
    .where(and(inArray(flashcards.trackId, trackIds), isNotNull(flashcards.dueAt)));
  for (const r of rows) {
    const c = out.get(r.trackId)!;
    c.total++;
    const state = cardState(r, now);
    if (state === "to_practise") c.due++;
    if (state === "known") c.known++;
  }
  const last = await db
    .select({ trackId: flashcardSessions.trackId, at: sql<Date>`max(${flashcardSessions.finishedAt})`.mapWith((v) => new Date(v)) })
    .from(flashcardSessions)
    .where(and(inArray(flashcardSessions.trackId, trackIds), isNotNull(flashcardSessions.finishedAt)))
    .groupBy(flashcardSessions.trackId);
  for (const l of last) out.get(l.trackId)!.lastAt = l.at;
  for (const c of out.values()) c.practise = practiseCount(c);
  return out;
}

export type DeckPage = {
  trackId: string;
  trackName: string;
  colorIndex: number;
  status: string;
  counts: DeckCount;
  topics: { name: string; cards: { id: string; front: string; answer: string; state: CardState; dueAt: Date; fromMissed: boolean }[] }[];
};

/** fc-6: a track's deck by topic, for the learner (both kinds: a child can see their own cards). */
export async function deckPage(actor: Actor, trackId: string, now = new Date()): Promise<DeckPage | null> {
  if (actor.kind !== "learner") return null;
  const own = await authorizeTrack(actor, "viewProgress", trackId);
  if (!own || own.track.status === "draft") return null;
  const tps = await db.select().from(topics).where(eq(topics.trackId, trackId)).orderBy(asc(topics.position));
  const cards = await db.select().from(flashcards).where(eq(flashcards.trackId, trackId)).orderBy(asc(flashcards.createdAt));
  const counts = (await deckCounts([trackId], now)).get(trackId)!;
  return {
    trackId,
    trackName: own.track.name ?? "",
    colorIndex: own.track.colorIndex,
    status: own.track.status,
    counts,
    topics: tps
      .map((t) => ({
        name: t.name,
        cards: cards
          .filter((c) => c.topicId === t.id)
          .map((c) => ({ id: c.id, front: c.front, answer: c.answer, state: cardState(c, now), dueAt: c.dueAt, fromMissed: c.source === "missed_question" })),
      }))
      .filter((t) => t.cards.length > 0),
  };
}

// ── F2 · A practice session (fc-2 to fc-4) ─────────────────────────────────

export type SessionCard = {
  id: string;
  topicName: string;
  front: string;
  answer: string;
  explanation: string;
  fromMissed: boolean;
};

export type StartedSession = { sessionId: string; trackId: string; trackName: string; colorIndex: number; cards: SessionCard[] } | null;

const STRENGTH_ORDER: Record<string, number> = { needs_work: 0, not_tested: 1, strong: 2 };

/**
 * Start a session on a track's deck for the learner practising (`practise`, editions §2.3, and consent, M10).
 * Cards due come first: lower boxes first, then weaker topics, then the longest overdue. With `again`, the cards
 * the learner said "Not yet" to in that session. With nothing due, a top-up is written first; with a few due, the
 * session starts with those and a top-up is written in the background.
 */
export async function startSession(actor: Actor, trackId: string, opts: { again?: string } = {}, now = new Date()): Promise<StartedSession> {
  const own = await authorizeTrack(actor, "practise", trackId);
  if (!own || !PRACTISE_STATUSES.includes(own.track.status)) return null;
  const { track, student } = own;

  let picked: (typeof flashcards.$inferSelect)[] = [];
  if (opts.again) {
    const rows = await db
      .select({ card: flashcards })
      .from(flashcardReviews)
      .innerJoin(flashcardSessions, eq(flashcardSessions.id, flashcardReviews.sessionId))
      .innerJoin(flashcards, eq(flashcards.id, flashcardReviews.cardId))
      .where(and(eq(flashcardReviews.sessionId, opts.again), eq(flashcardSessions.studentId, student.id), eq(flashcardSessions.trackId, trackId), eq(flashcardReviews.result, "not_yet")));
    picked = rows.map((r) => r.card);
  } else {
    let due = await dueCards(trackId, now);
    if (!due.length) {
      await writeDeck(trackId, "top_up");
      // New cards are due from the moment they're written, which is after `now`.
      due = await dueCards(trackId, new Date(Math.max(now.getTime(), Date.now())));
    } else if (due.length < F.sessionSize) {
      await enqueue("write_flashcards", { trackId, reason: "top_up" });
    }
    const strengths = (await topicStrengths(student.id, [trackId])).get(trackId) ?? [];
    const weakness = (topicId: string) => STRENGTH_ORDER[strengths.find((s) => s.id === topicId)?.strength ?? "not_tested"]!;
    picked = due
      .sort((a, b) => a.box - b.box || weakness(a.topicId) - weakness(b.topicId) || a.dueAt.getTime() - b.dueAt.getTime())
      .slice(0, F.sessionSize);
  }
  if (!picked.length) return { sessionId: "", trackId, trackName: track.name ?? "", colorIndex: track.colorIndex, cards: [] };

  const names = new Map((await db.select({ id: topics.id, name: topics.name }).from(topics).where(eq(topics.trackId, trackId))).map((t) => [t.id, t.name]));
  const [session] = await db.insert(flashcardSessions).values({ studentId: student.id, trackId, startedAt: now }).returning({ id: flashcardSessions.id });
  return {
    sessionId: session!.id,
    trackId,
    trackName: track.name ?? "",
    colorIndex: track.colorIndex,
    cards: picked.map((c) => ({ id: c.id, topicName: names.get(c.topicId) ?? "", front: c.front, answer: c.answer, explanation: c.explanation, fromMissed: c.source === "missed_question" })),
  };
}

async function dueCards(trackId: string, now: Date) {
  return db.select().from(flashcards).where(and(eq(flashcards.trackId, trackId), lte(flashcards.dueAt, now)));
}

/** The session, if it belongs to the learner practising and is still open. */
async function ownSession(actor: Actor, sessionId: string) {
  if (actor.kind !== "learner" || !/^[0-9a-f-]{36}$/i.test(sessionId)) return null;
  const [s] = await db.select().from(flashcardSessions).where(and(eq(flashcardSessions.id, sessionId), eq(flashcardSessions.studentId, actor.studentId)));
  if (!s || !(await authorizeTrack(actor, "practise", s.trackId))) return null;
  return s;
}

/**
 * "Got it" / "Not yet" on one card: recorded once per card per session, and the card moves box (Leitner): due again
 * after rules.flashcards.boxDays. Returns false if the session or card isn't the learner's.
 */
export async function reviewCard(actor: Actor, sessionId: string, cardId: string, result: "got_it" | "not_yet", now = new Date()): Promise<boolean> {
  const s = await ownSession(actor, sessionId);
  if (!s || s.finishedAt) return false;
  const [card] = await db.select().from(flashcards).where(and(eq(flashcards.id, cardId), eq(flashcards.trackId, s.trackId)));
  if (!card) return false;
  return db.transaction(async (tx) => {
    const added = await tx.insert(flashcardReviews).values({ sessionId, cardId, result, at: now }).onConflictDoNothing().returning({ cardId: flashcardReviews.cardId });
    if (!added.length) return true; // already answered in this session
    const box = nextBox(card.box, result);
    await tx.update(flashcards).set({ box, dueAt: dueAfter(box, now) }).where(eq(flashcards.id, cardId));
    await tx
      .update(flashcardSessions)
      .set({ cardsSeen: sql`${flashcardSessions.cardsSeen} + 1`, gotIt: sql`${flashcardSessions.gotIt} + ${result === "got_it" ? 1 : 0}` })
      .where(eq(flashcardSessions.id, sessionId));
    return true;
  });
}

export type SessionSummary = {
  cardsSeen: number;
  gotIt: number;
  notYet: number;
  minutes: number;
  byTopic: { topicName: string; gotIt: number; seen: number }[];
  /** When the next cards are due after the ones still being learnt, and how many. */
  next: { at: Date; count: number } | null;
  /** The track's exam waiting to be taken, for "Start exam N". */
  readyExam: { id: string; number: number } | null;
  /** Points this session earned (sessionPoints): 0 if it was short or the day's limit for the track was reached. */
  points: number;
};

/** Finish the session (fc-4), awarding its points once (sessionPoints). Finishing again just returns the summary. */
export async function finishSession(actor: Actor, sessionId: string, now = new Date()): Promise<SessionSummary | null> {
  const s = await ownSession(actor, sessionId);
  if (!s) return null;
  if (!s.finishedAt) await finishAndAward(s, now);
  const [award] = await db.select({ points: pointsEvents.points }).from(pointsEvents).where(eq(pointsEvents.flashcardSessionId, sessionId));
  const rows = await db
    .select({ result: flashcardReviews.result, topicName: topics.name })
    .from(flashcardReviews)
    .innerJoin(flashcards, eq(flashcards.id, flashcardReviews.cardId))
    .innerJoin(topics, eq(topics.id, flashcards.topicId))
    .where(eq(flashcardReviews.sessionId, sessionId));
  const byTopic = new Map<string, { gotIt: number; seen: number }>();
  for (const r of rows) {
    const t = byTopic.get(r.topicName) ?? { gotIt: 0, seen: 0 };
    t.seen++;
    if (r.result === "got_it") t.gotIt++;
    byTopic.set(r.topicName, t);
  }
  const later = await db
    .select({ dueAt: flashcards.dueAt })
    .from(flashcards)
    .where(and(eq(flashcards.trackId, s.trackId), gt(flashcards.dueAt, now)))
    .orderBy(asc(flashcards.dueAt));
  const firstDay = later[0] ? later[0].dueAt.toISOString().slice(0, 10) : null;
  const [open] = await db
    .select({ id: exams.id, number: exams.number })
    .from(exams)
    .where(and(eq(exams.trackId, s.trackId), inArray(exams.status, ["ready", "in_progress"])));
  const gotIt = rows.filter((r) => r.result === "got_it").length;
  return {
    cardsSeen: rows.length,
    gotIt,
    notYet: rows.length - gotIt,
    minutes: Math.max(1, Math.round((now.getTime() - s.startedAt.getTime()) / 60_000)),
    byTopic: [...byTopic.entries()].map(([topicName, v]) => ({ topicName, ...v })),
    next: firstDay ? { at: later[0]!.dueAt, count: later.filter((l) => l.dueAt.toISOString().slice(0, 10) === firstDay).length } : null,
    readyExam: open ?? null,
    points: award?.points ?? 0,
  };
}

/** Marks the session finished and awards its points, in one transaction so the daily limit holds. */
async function finishAndAward(s: typeof flashcardSessions.$inferSelect, now: Date) {
  await db.transaction(async (tx) => {
    // Lock the session row: a second finish waits, then sees it finished.
    const [locked] = await tx.select().from(flashcardSessions).where(eq(flashcardSessions.id, s.id)).for("update");
    if (!locked || locked.finishedAt) return;
    await tx.update(flashcardSessions).set({ finishedAt: now }).where(eq(flashcardSessions.id, s.id));
    const [student] = await tx.select({ timeZone: students.timeZone }).from(students).where(eq(students.id, s.studentId)).for("update");
    const tz = student?.timeZone ?? "UTC";
    const recent = await tx
      .select({ at: pointsEvents.createdAt })
      .from(pointsEvents)
      .innerJoin(flashcardSessions, eq(flashcardSessions.id, pointsEvents.flashcardSessionId))
      .where(and(eq(pointsEvents.studentId, s.studentId), eq(flashcardSessions.trackId, s.trackId), gt(pointsEvents.createdAt, new Date(now.getTime() - 2 * 24 * 60 * 60_000))));
    const today = todayIn(tz, now);
    const points = sessionPoints(locked.cardsSeen, recent.filter((r) => todayIn(tz, r.at) === today).length);
    if (!points) return;
    const [track] = await tx.select({ name: tracks.name }).from(tracks).where(eq(tracks.id, s.trackId));
    await tx.insert(pointsEvents).values({ studentId: s.studentId, flashcardSessionId: s.id, kind: "flashcards", points, label: `Flashcards: ${track?.name ?? "practice"}`, createdAt: now });
  });
}
