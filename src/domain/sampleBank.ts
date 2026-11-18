import type { PlanSlot, QuestionType, WrittenQuestion } from "./examPlan";

/** A question written in advance for a sample track (owner, 2026-11-18). `topic` indexes the track's topics. */
export type BankQuestion = {
  topic: number;
  type: QuestionType;
  prompt: string;
  options?: string[];
  correctIndex?: number;
  expectedAnswer?: string;
  explanation: string;
  difficulty: number;
};

export type SampleTrack = {
  key: string;
  name: string;
  topics: { name: string; description: string }[];
  questions: BankQuestion[];
  flashcards: { topic: number; front: string; answer: string; explanation: string }[];
};

const same = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Builds a sample track's next exam from its question bank instead of asking the AI. It follows the same plan as
 * any track (rules §4: topic mix from the learner's results, harder questions when every topic is strong), so the
 * sample adapts like a real track.
 *
 * For each slot, among the bank's questions on that topic not already on this paper, it prefers in order:
 * a question not used in the recent exams (rules §4: none repeated within 3 exams), or failing that the one used
 * longest ago; a missed question the plan asks to bring back (`retryOf`, asked again as it was); the planned type;
 * harder questions for a `harder` slot, otherwise easier ones first; then chance. If a topic runs out, another
 * topic's question fills the slot. Multiple choice comes first on the paper.
 *
 * `recent`: the prompts of the track's latest exams, newest exam first.
 */
export function pickFromBank(plan: PlanSlot[], bank: BankQuestion[], topicKeys: string[], recent: string[][], random: () => number = Math.random): WrittenQuestion[] {
  const used = new Set<BankQuestion>();
  const age = (q: BankQuestion) => {
    const i = recent.findIndex((exam) => exam.some((p) => same(p) === same(q.prompt)));
    return i === -1 ? recent.length : i; // higher is better: never used, or used longer ago
  };
  const jitter = new Map(bank.map((q) => [q, random()]));

  const picked: WrittenQuestion[] = [];
  for (const slot of plan) {
    const topic = topicKeys.indexOf(slot.topicKey);
    let pool = bank.filter((q) => q.topic === topic && !used.has(q));
    if (!pool.length) pool = bank.filter((q) => !used.has(q));
    if (!pool.length) break;
    const score = (q: BankQuestion) => [
      -age(q),
      slot.retryOf && same(slot.retryOf) === same(q.prompt) ? 0 : 1,
      q.type === slot.type ? 0 : 1,
      slot.harder ? -q.difficulty : q.difficulty,
      jitter.get(q)!,
    ];
    const best = pool.reduce((a, b) => {
      const [sa, sb] = [score(a), score(b)];
      for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return sa[i]! < sb[i]! ? a : b;
      return a;
    });
    used.add(best);
    picked.push({
      topicKey: topicKeys[best.topic] ?? slot.topicKey,
      type: best.type,
      prompt: best.prompt,
      options: best.type === "multiple_choice" ? best.options! : [],
      correctIndex: best.type === "multiple_choice" ? best.correctIndex! : null,
      expectedAnswer: best.type === "short" ? best.expectedAnswer! : null,
      explanation: best.explanation,
      difficulty: best.difficulty,
    });
  }
  const rank = (t: QuestionType) => (t === "multiple_choice" ? 0 : 1);
  return picked.map((q, i) => ({ q, i })).sort((a, b) => rank(a.q.type) - rank(b.q.type) || a.i - b.i).map(({ q }) => q);
}
