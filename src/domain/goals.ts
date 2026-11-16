import { rules } from "@/config/rules";
import type { Strength } from "./topicStrength";

/**
 * Rules §3: progress counts consecutive qualifying exams in the track, newest backwards, and resets to 0 on an
 * exam below X.
 */
export function goalProgress(scoresOldestFirst: number[], threshold: number): number {
  let run = 0;
  for (let i = scoresOldestFirst.length - 1; i >= 0 && scoresOldestFirst[i]! >= threshold; i--) run++;
  return run;
}

export type CoverageMode = "all_strong" | "all_tested" | "off";
export type CoverageTopic = { strength: Strength; revisionOnly: boolean };

/** Only the track's active topics count; after a restart (2j) the earlier topics are revision. */
const activeTopics = (topics: CoverageTopic[]) => topics.filter((t) => !t.revisionOnly);

/** How many active topics are strong, out of how many (for "10 of 12 topics strong"). */
export function topicCoverage(topics: CoverageTopic[]): { strong: number; total: number } {
  const active = activeTopics(topics);
  return { strong: active.filter((t) => t.strength === "strong").length, total: active.length };
}

/**
 * 0.2 coverage (rules §3): every active topic strong ("all_strong"), or none untested and none needing work
 * ("all_tested"; the same as all_strong under today's strength rules, §4), or not required ("off", 0.1).
 */
export function coverageMet(topics: CoverageTopic[], mode: CoverageMode = rules.goal.coverage): boolean {
  if (mode === "off") return true;
  const active = activeTopics(topics);
  if (mode === "all_tested") return active.every((t) => t.strength !== "not_tested" && t.strength !== "needs_work");
  return active.every((t) => t.strength === "strong");
}

/** The goal is reached when the score run is complete and the topics are covered. */
export function goalReached(progress: number, runLength: number, covered = true): boolean {
  return progress >= runLength && covered;
}

/**
 * How far a track is towards its goal, 0 to 1, for the bar on the card's left edge (owner, 2026-11-16): half for
 * the score run, half for the topics made strong (or all of it for the run, when coverage is off). 1 once reached.
 */
export function trackCompletion(t: { progress: number; runLength: number; topics: CoverageTopic[]; reached: boolean }, mode: CoverageMode = rules.goal.coverage): number {
  if (t.reached) return 1;
  const run = t.runLength > 0 ? Math.min(t.progress, t.runLength) / t.runLength : 0;
  if (mode === "off") return run;
  const { strong, total } = topicCoverage(t.topics);
  const topics = total > 0 ? strong / total : 0;
  return Math.min(1, (run + topics) / 2);
}
