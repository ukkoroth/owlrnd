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
 * What a background top-up asks for, at most `rules.pool.batchMax` questions: first a new wording of each missed
 * question waiting for one (a "retry" slot, up to half the batch), then only the new questions the stock lacks:
 * each topic up to `rules.pool.stockPerTopic` for its strength (weak topics first), then the whole pool up to
 * `rules.pool.examsAhead` exams, spread by the exam mix (rules §4). At least half multiple choice.
 * `stock`: unused questions per topic key now. Nothing lacking and nothing to reword: an empty plan, so no AI call.
 */
export function poolWritePlan(active: MixTopic[], revision: MixTopic[], rewords: { topicKey: string; type: QuestionType; prompt: string }[], stock: Map<string, number>): PlanSlot[] {
  const max = rules.pool.batchMax;
  const retries: PlanSlot[] = rewords.slice(0, Math.floor(max / 2)).map((r) => ({ topicKey: r.topicKey, type: r.type, retryOf: r.prompt }));
  const room = max - retries.length;
  const have = new Map(stock);
  for (const r of retries) have.set(r.topicKey, (have.get(r.topicKey) ?? 0) + 1);

  // Topics below their stock, weakest first.
  const target = (t: MixTopic, isRevision: boolean) => (isRevision ? rules.pool.stockPerTopic.revision : rules.pool.stockPerTopic[t.strength]);
  const rank = { needs_work: 0, not_tested: 1, strong: 2 } as const;
  const byNeed = [...active.map((t) => ({ t, rev: false })), ...revision.map((t) => ({ t, rev: true }))].sort(
    (a, b) => Number(a.rev) - Number(b.rev) || rank[a.t.strength] - rank[b.t.strength],
  );
  const fresh: PlanSlot[] = [];
  for (const { t, rev } of byNeed) {
    const lack = Math.max(0, target(t, rev) - (have.get(t.key) ?? 0));
    for (let i = 0; i < lack && fresh.length < room; i++) fresh.push({ topicKey: t.key, type: "multiple_choice" });
  }

  // Then the whole pool up to `examsAhead` exams' worth, by the usual mix.
  const total = [...have.values()].reduce((a, b) => a + b, 0) + fresh.length;
  const more = Math.min(room - fresh.length, Math.max(0, rules.pool.examsAhead * rules.exam.maxQuestions - total));
  if (more > 0 && (active.length || revision.length)) {
    for (const s of planWithRevision(active, revision, more)) fresh.push({ topicKey: s.topicKey, type: s.type, ...(s.harder ? { harder: true } : {}) });
  }
  const types = assignTypes(fresh.length);
  fresh.forEach((s, i) => (s.type = types[i]!));
  return [...retries, ...fresh];
}

/**
 * When an exam can't be made from the pool and the learner is waiting: only the questions this exam's plan lacks
 * (each planned topic up to its slots, then up to the paper's length), so the wait is as short as it can be. The
 * background top-up writes the rest.
 */
export function shortfallPlan(plan: PlanSlot[], candidates: PoolQuestion[], topicKeys: string[]): PlanSlot[] {
  const want = new Map<string, PlanSlot[]>();
  for (const s of plan) want.set(s.topicKey, [...(want.get(s.topicKey) ?? []), s]);
  const lacking: PlanSlot[] = [];
  for (const [key, slots] of want) {
    const have = candidates.filter((c) => topicKeys[c.topic] === key).length;
    lacking.push(...slots.slice(have).map((s) => ({ topicKey: s.topicKey, type: s.type, ...(s.harder ? { harder: true } : {}) })));
  }
  // Too few overall even so (the other topics' spares are short too): more of the plan's own topics.
  for (let i = 0; candidates.length + lacking.length < plan.length; i++) {
    const s = plan[i % plan.length]!;
    lacking.push({ topicKey: s.topicKey, type: s.type });
  }
  const types = assignTypes(lacking.length);
  lacking.forEach((s, i) => (s.type = types[i]!));
  return lacking;
}
