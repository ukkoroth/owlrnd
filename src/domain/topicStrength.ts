import { rules } from "@/config/rules";

export type Strength = "strong" | "needs_work" | "not_tested";

/**
 * Rules §4 plus the owner's decision (M5). Looks at the topic's last `window` answers (oldest first):
 * - strong: at least 80% right, with at least 3 answered;
 * - needs work: any miss, and not strong;
 * - not tested: nothing answered, or only 1–2 answered and all right (not enough evidence either way).
 */
export function strengthOf(resultsOldestFirst: boolean[]): Strength {
  const { window, minAnswered, strongShare } = rules.topicStrength;
  const recent = resultsOldestFirst.slice(-window);
  if (recent.length === 0) return "not_tested";
  const right = recent.filter(Boolean).length;
  if (recent.length >= minAnswered && right / recent.length >= strongShare) return "strong";
  if (right < recent.length) return "needs_work";
  return "not_tested";
}

/** "4 of its last 5 questions right." in words, from the rule's settings (for learners). */
export function strongRuleWords(): string {
  const { window, strongShare } = rules.topicStrength;
  return `at least ${Math.ceil(window * strongShare - 1e-9)} of its last ${window} questions right.`;
}

export type TopicTally = { topicId: string; name: string; right: number; total: number };

/** 4.1e: this exam's Strengths and Needs work, per topic ("3 of 3", "1 of 2"). A strength is ≥ 80% in this exam. */
export function examTopicSummary(results: { topicId: string; name: string; correct: boolean }[]) {
  const tallies = new Map<string, TopicTally>();
  for (const r of results) {
    const t = tallies.get(r.topicId) ?? { topicId: r.topicId, name: r.name, right: 0, total: 0 };
    t.total++;
    if (r.correct) t.right++;
    tallies.set(r.topicId, t);
  }
  const all = [...tallies.values()];
  const isStrong = (t: TopicTally) => t.right / t.total >= rules.topicStrength.strongShare;
  return { strengths: all.filter(isStrong), needsWork: all.filter((t) => !isStrong(t)) };
}
