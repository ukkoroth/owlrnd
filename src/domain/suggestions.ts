import { rules } from "@/config/rules";
import { todayIn } from "./tracks";

export type SuggestionCandidate = {
  id: string;
  status: "active" | "paused" | "goal_reached" | "archived" | "draft";
  testDate: string | null;
  lastPracticedAt: Date | null;
  weakTopics: number;
  /** The track's next exam, if one is ready or already started. */
  exam: { id: string; number: number; status: "ready" | "in_progress" } | null;
};

/**
 * Rules §7: up to 3 suggested exams, at most one per track, only from active tracks. Order: the track with the
 * nearest upcoming test first; then the track not practised for the longest; then the one with the most weak topics.
 */
export function suggestExams<T extends SuggestionCandidate>(tracks: T[], today: string): T[] {
  const upcoming = (t: T) => (t.testDate && t.testDate >= today ? t.testDate : null);
  return tracks
    .filter((t) => t.status === "active" && t.exam)
    .sort((a, b) => {
      const da = upcoming(a);
      const db = upcoming(b);
      if (da !== db) {
        if (da === null) return 1;
        if (db === null) return -1;
        return da < db ? -1 : 1;
      }
      const la = a.lastPracticedAt?.getTime() ?? -Infinity;
      const lb = b.lastPracticedAt?.getTime() ?? -Infinity;
      if (la !== lb) return la - lb;
      return b.weakTopics - a.weakTopics;
    })
    .slice(0, rules.suggestions.max);
}

/** "N completed today" (rules §7), counted in the student's time zone. */
export function completedToday(submittedAt: Date[], timeZone: string, now = new Date()): number {
  const today = todayIn(timeZone, now);
  return submittedAt.filter((d) => todayIn(timeZone, d) === today).length;
}
