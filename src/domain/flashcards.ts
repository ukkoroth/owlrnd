import { rules } from "@/config/rules";
import type { Strength } from "./topicStrength";

/** 0.3 Flashcards (docs/plan-0.3-flashcards.md): how many cards each topic gets, and checks on what the AI writes. */

export type DeckTopic = { key: string; strength: Strength; revision: boolean; existing: number };
export type CardSlot = { topicKey: string; count: number };

const F = rules.flashcards;

/**
 * The starter deck (a new track, or new topics added): up to `starterPerTopic` cards for each active topic and
 * `revisionPerTopic` for each revision topic, counting cards the topic already has, within `starterMax` for this
 * batch and the deck's room under `deckMax`.
 */
export function planStarter(topics: DeckTopic[], deckSize: number): CardSlot[] {
  let room = Math.min(F.starterMax, Math.max(0, F.deckMax - deckSize));
  const slots: CardSlot[] = [];
  for (const t of [...topics.filter((x) => !x.revision), ...topics.filter((x) => x.revision)]) {
    const want = Math.max(0, (t.revision ? F.revisionPerTopic : F.starterPerTopic) - t.existing);
    const count = Math.min(want, room);
    if (count > 0) slots.push({ topicKey: t.key, count });
    room -= count;
    if (room <= 0) break;
  }
  return slots;
}

/** Share of a top-up by topic strength, as exams weight them (rules §4). */
const WEIGHT: Record<Strength, number> = { needs_work: 5, not_tested: 3, strong: 2 };

/**
 * A top-up when too few cards are due: `total` cards spread over the active topics, weighted to weak and untested
 * ones and to topics with fewer cards, within the deck's room.
 */
export function planTopUp(topics: DeckTopic[], deckSize: number, total = F.topUp): CardSlot[] {
  const active = topics.filter((t) => !t.revision);
  const n = Math.min(total, Math.max(0, F.deckMax - deckSize));
  if (!active.length || n <= 0) return [];
  const score = (t: DeckTopic) => WEIGHT[t.strength] / (1 + t.existing / 4);
  const counts = new Map<string, number>(active.map((t) => [t.key, 0]));
  // Hand out one card at a time to the topic with the highest weight per card already given.
  for (let i = 0; i < n; i++) {
    const best = active.reduce((a, b) => (score(b) / (1 + counts.get(b.key)!) > score(a) / (1 + counts.get(a.key)!) ? b : a));
    counts.set(best.key, counts.get(best.key)! + 1);
  }
  return active.filter((t) => counts.get(t.key)! > 0).map((t) => ({ topicKey: t.key, count: counts.get(t.key)! }));
}

export type WrittenCard = { topicKey: string; front: string; answer: string; explanation: string; missedKey: string | null };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Problems with the AI's cards; empty when they can be saved. Known fronts must not be repeated. */
export function validateCards(cards: WrittenCard[], topicKeys: string[], knownFronts: string[], missedKeys: string[] = []): string[] {
  const errors: string[] = [];
  const seen = new Set(knownFronts.map(norm));
  cards.forEach((c, i) => {
    const at = `Card ${i + 1}`;
    if (!topicKeys.includes(c.topicKey)) errors.push(`${at}: unknown topic key ${c.topicKey}.`);
    if (c.missedKey && !missedKeys.includes(c.missedKey)) errors.push(`${at}: unknown missed-question key ${c.missedKey}.`);
    if (!c.front.trim() || c.front.length > F.maxFront) errors.push(`${at}: the front must be 1–${F.maxFront} characters.`);
    if (!c.answer.trim() || c.answer.length > F.maxAnswer) errors.push(`${at}: the answer must be 1–${F.maxAnswer} characters.`);
    if (!c.explanation.trim() || c.explanation.length > F.maxExplanation) errors.push(`${at}: the explanation must be 1–${F.maxExplanation} characters.`);
    const key = norm(c.front);
    if (seen.has(key)) errors.push(`${at}: repeats an existing card ("${c.front.slice(0, 60)}").`);
    seen.add(key);
  });
  return errors;
}

const words = (s: string) => new Set(norm(s).split(" ").filter(Boolean));

/** Near-copies: share at least rules.flashcards.repeats.similarity of their words (Jaccard), ignoring case and punctuation. */
export function sameWording(a: string, b: string): boolean {
  const x = words(a);
  const y = words(b);
  if (!x.size || !y.size) return false;
  let shared = 0;
  for (const w of x) if (y.has(w)) shared++;
  return shared / (x.size + y.size - shared) >= F.repeats.similarity;
}

/** Each text that is a near-copy of one of `others`, with what it copies. */
export function repeatsOf(texts: string[], others: string[]): { index: number; like: string }[] {
  const out: { index: number; like: string }[] = [];
  texts.forEach((t, index) => {
    const like = others.find((o) => sameWording(t, o));
    if (like) out.push({ index, like });
  });
  return out;
}

/**
 * Exams and flashcards rarely repeat each other (rules.flashcards.repeats): problems to send back to the writer
 * when there are more near-copies than allowed, else none.
 */
export function tooManyRepeats(texts: string[], others: string[], label: string): string[] {
  const found = repeatsOf(texts, others);
  if (found.length <= F.repeats.maxPerWrite) return [];
  return found.map((r) => `${label} ${r.index + 1} repeats the wording of "${r.like.slice(0, 80)}"; ask the same idea differently.`);
}

/** Spaced repetition (Leitner boxes): "Got it" moves a card up a box (at most 5); "Not yet" sends it back to 1. */
export function nextBox(box: number, result: "got_it" | "not_yet"): number {
  return result === "got_it" ? Math.min(F.boxDays.length, box + 1) : 1;
}

/** When a card in `box` is due again. */
export function dueAfter(box: number, now: Date): Date {
  const days = F.boxDays[Math.max(1, Math.min(F.boxDays.length, box)) - 1]!;
  return new Date(now.getTime() + days * 24 * 60 * 60_000);
}
