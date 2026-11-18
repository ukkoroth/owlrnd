import { rules } from "@/config/rules";
import { assignTypes, type PlanSlot, type QuestionType } from "./examPlan";
import { planWithRevision, type MixTopic } from "./examMix";
import type { BankQuestion } from "./sampleBank";

/**
 * The question pool (roadmap 23, owner 2026-11-18). A track's questions are written in batches; each exam is picked
 * from the ones not yet used, with the usual adaptive plan. A question the learner missed comes back after
 * `rules.exam.repeatWindowExams` exams, but only in new words: the next pool write adds a reworded copy
 * (`variantOf` the original), and the two count as one idea for the repeat window. Questions answered right, and
 * the exact wording of a missed one, are never offered again.
 */
export type PoolRow = {
  id: string;
  topicKey: string;
  type: QuestionType;
  prompt: string;
  options: string[];
  correctIndex: number | null;
  expectedAnswer: string | null;
  explanation: string;
  difficulty: number;
  /** The idea it belongs to: the original question's id (its own id unless it is a rewording). */
  group: string;
  /** It has been on an exam. */
  used: boolean;
  /** The learner missed it on a marked exam. */
  missed: boolean;
  /** A rewording of it already exists. */
  reworded: boolean;
};

/** A pool question with its database id, for the picker. */
export type PoolQuestion = BankQuestion & { id: string };

/**
 * The questions an exam can be picked from: unused ones whose idea wasn't on any of the last exams (`recentGroups`,
 * newest exam first). Topic indexes follow `topicKeys`.
 */
export function poolCandidates(rows: PoolRow[], recentGroups: string[][], topicKeys: string[]): PoolQuestion[] {
  const recent = new Set(recentGroups.flat());
  return rows
    .filter((r) => !r.used && !recent.has(r.group) && topicKeys.includes(r.topicKey))
    .map((r) => ({
      id: r.id,
      topic: topicKeys.indexOf(r.topicKey),
      type: r.type,
      prompt: r.prompt,
      options: r.options,
      correctIndex: r.correctIndex ?? undefined,
      expectedAnswer: r.expectedAnswer ?? undefined,
      explanation: r.explanation,
      difficulty: r.difficulty,
    }));
}

/** Missed questions still waiting for their new wording, oldest first. */
export const awaitingRewording = (rows: PoolRow[]) => rows.filter((r) => r.used && r.missed && !r.reworded);

/**
 * Whether the pool can make this exam: enough questions overall, and every planned topic has at least half of its
 * slots (the picker fills the rest from other topics, so a short topic never blocks an exam).
 */
export function canFill(plan: PlanSlot[], candidates: PoolQuestion[], topicKeys: string[]): boolean {
  if (candidates.length < plan.length) return false;
  const want = new Map<string, number>();
  for (const s of plan) want.set(s.topicKey, (want.get(s.topicKey) ?? 0) + 1);
  for (const [key, n] of want) {
    const have = candidates.filter((c) => topicKeys[c.topic] === key).length;
    if (have < Math.ceil(n / 2)) return false;
  }
  return true;
}

/** After an exam is made: top up when few unused questions are left, or several misses wait for new words. */
export const needsTopUp = (unusedLeft: number, awaiting: number) => unusedLeft < rules.pool.lowWater || awaiting >= rules.pool.rewordAfterMisses;

/**
 * What one pool write asks for, at most `rules.pool.batchMax` questions: first a new wording of each missed question
 * waiting for one (a "retry" slot, up to half the batch), then new questions spread by the exam mix (rules §4: weak
 * topics most), with every active topic getting at least `rules.pool.minPerTopic`. At least half multiple choice.
 * `size`: how many new questions are wanted, before the rewordings.
 */
export function poolWritePlan(active: MixTopic[], revision: MixTopic[], rewords: { topicKey: string; type: QuestionType; prompt: string }[], size: number): PlanSlot[] {
  const max = rules.pool.batchMax;
  const retries: PlanSlot[] = rewords.slice(0, Math.floor(max / 2)).map((r) => ({ topicKey: r.topicKey, type: r.type, retryOf: r.prompt }));
  const room = Math.max(0, Math.min(size, max - retries.length));
  if (!room || (!active.length && !revision.length)) return retries;

  const fresh: PlanSlot[] = planWithRevision(active, revision, room).map((s) => ({ topicKey: s.topicKey, type: s.type, ...(s.harder ? { harder: true } : {}) }));
  // Every active topic gets its minimum, taken from the topic with the most slots.
  const min = Math.min(rules.pool.minPerTopic, Math.floor(room / Math.max(1, active.length)));
  for (const t of active) {
    while (fresh.filter((s) => s.topicKey === t.key).length < min) {
      const counts = new Map<string, number>();
      for (const s of fresh) counts.set(s.topicKey, (counts.get(s.topicKey) ?? 0) + 1);
      const [biggest] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [];
      if (!biggest || (counts.get(biggest) ?? 0) <= min) break;
      const i = fresh.findIndex((s) => s.topicKey === biggest);
      fresh[i] = { topicKey: t.key, type: fresh[i]!.type };
    }
  }
  const types = assignTypes(fresh.length);
  fresh.forEach((s, i) => (s.type = types[i]!));
  return [...retries, ...fresh];
}
