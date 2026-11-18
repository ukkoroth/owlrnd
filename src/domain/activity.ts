import { rules } from "@/config/rules";
import { addDays } from "./points";
import { todayIn } from "./tracks";

/** Completed exams per day, in the student's time zone (rules §9). */
export function dailyCounts(submittedAt: Date[], timeZone: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const d of submittedAt) {
    const day = todayIn(timeZone, d);
    m.set(day, (m.get(day) ?? 0) + 1);
  }
  return m;
}

const weekday = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 = Sunday
const dayName = (iso: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
// Three-letter months as in the mockup ("Sep", not en-GB's "Sept").
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthName = (iso: string) => MONTHS[Number(iso.slice(5, 7)) - 1]!;

/** `flashcards`: flashcard sessions that day (0.3), a separate series that never counts as exams. */
export type Bar = { date: string; label: string; count: number; isToday: boolean; flashcards: number };

/** The 7-day bar chart: the last 7 days ending today (rules §9). */
export function last7Days(counts: Map<string, number>, today: string, flashcards: Map<string, number> = new Map()): Bar[] {
  return Array.from({ length: rules.activity.barDays }, (_, i) => {
    const date = addDays(today, i - (rules.activity.barDays - 1));
    return { date, label: date === today ? "Today" : dayName(date), count: counts.get(date) ?? 0, isToday: date === today, flashcards: flashcards.get(date) ?? 0 };
  });
}

export type Cell = { date: string; count: number; shade: 0 | 1 | 2 | 3 | 4; isToday: boolean; future: boolean };
export type Grid = { weeks: Cell[][]; months: { column: number; label: string }[]; total: number };

/**
 * The 26-week activity grid (rules §9): one square per day, weeks as columns (Sunday at the top), today outlined in
 * the last column; days after today are left empty. Shades for 0, 1, 2, 3 and 4 or more exams.
 */
export function activityGrid(counts: Map<string, number>, today: string): Grid {
  const weeksBack = rules.activity.gridWeeks;
  const firstSunday = addDays(today, -weekday(today) - (weeksBack - 1) * 7);
  const weeks: Cell[][] = [];
  const months: Grid["months"] = [];
  let total = 0;
  for (let w = 0; w < weeksBack; w++) {
    const col: Cell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(firstSunday, w * 7 + d);
      const future = date > today;
      const count = future ? 0 : (counts.get(date) ?? 0);
      total += count;
      col.push({ date, count, shade: Math.min(count, rules.activity.maxShade) as Cell["shade"], isToday: date === today, future });
    }
    const label = monthName(col[0]!.date);
    // Label a column when its month differs from the previous column's (and not on the very first, partial week).
    if (w > 0 && label !== monthName(weeks[w - 1]![0]!.date)) months.push({ column: w, label });
    weeks.push(col);
  }
  return { weeks, months, total };
}

/** One marked exam on the learner's overall scores chart (3d). */
export type ScoredExam = { id: string; trackId: string; trackName: string; colorIndex: number; overallNumber: number | null; score: number; submittedAt: Date };
export type TrackScores = { trackId: string; trackName: string; colorIndex: number; count: number; average: number; latest: number };
export type ScoreSummary = { count: number; average: number; recentAverage: number | null; tracks: TrackScores[] };

const oneDecimal = (n: number) => Math.round(n * 10) / 10;
const mean = (xs: number[]) => oneDecimal(xs.reduce((s, x) => s + x, 0) / xs.length);

/**
 * The overall analysis on Recent exams (owner, 2026-11-18), from marked exams oldest first: how many, the average
 * score out of 10, the average of the last `recent` exams (only once there are more than that, or it says nothing
 * new), and per track the count, average and latest score, the most practised track first.
 */
export function scoreSummary(exams: ScoredExam[], recent = 5): ScoreSummary {
  if (!exams.length) return { count: 0, average: 0, recentAverage: null, tracks: [] };
  const byTrack = new Map<string, ScoredExam[]>();
  for (const e of exams) byTrack.set(e.trackId, [...(byTrack.get(e.trackId) ?? []), e]);
  const tracks = [...byTrack.values()]
    .map((rows) => ({
      trackId: rows[0]!.trackId,
      trackName: rows[0]!.trackName,
      colorIndex: rows[0]!.colorIndex,
      count: rows.length,
      average: mean(rows.map((r) => r.score)),
      latest: rows[rows.length - 1]!.score,
    }))
    .sort((a, b) => b.count - a.count || a.trackName.localeCompare(b.trackName));
  return {
    count: exams.length,
    average: mean(exams.map((e) => e.score)),
    recentAverage: exams.length > recent ? mean(exams.slice(-recent).map((e) => e.score)) : null,
    tracks,
  };
}
