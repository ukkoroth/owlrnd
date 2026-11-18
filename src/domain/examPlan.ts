import { rules } from "@/config/rules";

export type QuestionType = (typeof rules.exam.types)[number];
export type PlanSlot = {
  topicKey: string;
  type: QuestionType;
  /** All topics strong: ask at a harder level (rules §4). */
  harder?: boolean;
  /** Reword this recently missed question (rules §4: a missed question may come back, reworded). */
  retryOf?: string;
};

/**
 * Rules §4, first exam in a track: cover every topic about evenly, up to `maxQuestions`, at least half multiple
 * choice. Topics beyond `maxQuestions` wait for the next exam. Multiple choice comes first on the paper.
 */
export function firstExamPlan(topicKeys: string[], opts = { total: rules.exam.maxQuestions, mcqShare: rules.exam.minMultipleChoiceShare }): PlanSlot[] {
  if (topicKeys.length === 0) return [];
  const keys = topicKeys.slice(0, opts.total);
  const total = opts.total;

  // Round-robin over topics so each topic gets its share, and the remainder goes to the first topics.
  const order: string[] = [];
  for (let i = 0; i < total; i++) order.push(keys[i % keys.length]!);

  const types = assignTypes(total, opts.mcqShare);
  const slots = order.map((topicKey, i): PlanSlot => ({ topicKey, type: types[i]! }));

  const rank = (t: QuestionType) => (t === "multiple_choice" ? 0 : 1);
  const topicIndex = (k: string) => keys.indexOf(k);
  return slots.sort((a, b) => rank(a.type) - rank(b.type) || topicIndex(a.topicKey) - topicIndex(b.topicKey));
}

/** Spreads multiple choice evenly through `n` slots (at least `mcqShare` of them), so every topic gets a mix. */
export function assignTypes(n: number, mcqShare: number = rules.exam.minMultipleChoiceShare): QuestionType[] {
  const mcq = Math.ceil(n * mcqShare);
  return Array.from({ length: n }, (_, i) => (Math.floor(((i + 1) * mcq) / n) > Math.floor((i * mcq) / n) ? "multiple_choice" : "short"));
}

export type WrittenQuestion = {
  topicKey: string;
  type: QuestionType;
  prompt: string;
  options: string[];
  correctIndex: number | null;
  expectedAnswer: string | null;
  explanation: string;
  difficulty: number;
  /** Picked from the track's question pool: the existing question's id (no new row is written). */
  sourceId?: string;
};

const samePrompt = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Checks the AI's questions against the plan (AI §3), and that none repeats a prompt from the last exams
 * (rules §4: no identical question within 3 exams). Returns human-readable problems; empty means valid.
 */
export function validateWrittenExam(plan: PlanSlot[], questions: WrittenQuestion[], avoid: string[] = []): string[] {
  const errors: string[] = [];
  const recent = new Set(avoid.map(samePrompt));
  if (questions.length !== plan.length) errors.push(`Expected ${plan.length} questions, got ${questions.length}.`);

  const want = new Map<string, number>();
  for (const s of plan) want.set(`${s.topicKey}|${s.type}`, (want.get(`${s.topicKey}|${s.type}`) ?? 0) + 1);
  const topics = new Set(plan.map((s) => s.topicKey));

  questions.forEach((q, i) => {
    const n = `Question ${i + 1}`;
    if (!topics.has(q.topicKey)) errors.push(`${n}: topic ${q.topicKey} is not one of this exam's topics.`);
    if (!q.prompt.trim() || q.prompt.length > 600) errors.push(`${n}: the prompt must be 1–600 characters.`);
    if (recent.has(samePrompt(q.prompt))) errors.push(`${n}: repeats a question from a recent exam word for word; write a new one.`);
    if (!q.explanation.trim()) errors.push(`${n}: needs a one-line explanation.`);
    if (!Number.isInteger(q.difficulty) || q.difficulty < 1 || q.difficulty > 5) errors.push(`${n}: difficulty must be 1–5.`);
    if (q.type === "multiple_choice") {
      const opts = q.options.map((o) => o.trim());
      if (opts.length !== 4 || opts.some((o) => !o)) errors.push(`${n}: multiple choice needs exactly 4 non-empty options.`);
      else if (new Set(opts.map((o) => o.toLowerCase())).size !== 4) errors.push(`${n}: the 4 options must all be different.`);
      if (q.correctIndex === null || !Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex > 3) {
        errors.push(`${n}: correctIndex must be 0–3.`);
      }
    } else {
      if (q.options.length) errors.push(`${n}: short answers have no options.`);
      if (!q.expectedAnswer?.trim()) errors.push(`${n}: short answers need an expected answer.`);
    }
    const key = `${q.topicKey}|${q.type}`;
    want.set(key, (want.get(key) ?? 0) - 1);
  });

  for (const [key, left] of want) {
    if (left !== 0) {
      const [topic, type] = key.split("|");
      errors.push(`Topic ${topic}: ${left > 0 ? `${left} ${type} question(s) missing` : `${-left} ${type} question(s) too many`}.`);
    }
  }
  return errors;
}
