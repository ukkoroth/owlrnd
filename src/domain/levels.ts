import { rules } from "@/config/rules";

export type LevelInfo = {
  /** Current level name, or null before the first threshold. */
  current: string | null;
  next: { name: string; at: number; pointsToGo: number } | null;
};

/** Level from total points (rules §8). Thresholds come from config. */
export function levelFor(totalPoints: number, levels = rules.points.levels): LevelInfo {
  let current: string | null = null;
  for (const level of levels) {
    if (totalPoints >= level.at) current = level.name;
  }
  const upcoming = levels.find((l) => totalPoints < l.at);
  return {
    current,
    next: upcoming ? { name: upcoming.name, at: upcoming.at, pointsToGo: upcoming.at - totalPoints } : null,
  };
}

/** 4.3a: current level, the next one, points to go, and how far along the bar is (0–1). */
export function levelProgress(totalPoints: number, levels = rules.points.levels) {
  const info = levelFor(totalPoints, levels);
  const from = [...levels].reverse().find((l) => totalPoints >= l.at)?.at ?? 0;
  const share = info.next ? (totalPoints - from) / (info.next.at - from) : 1;
  return { ...info, share: Math.max(0, Math.min(1, share)) };
}
