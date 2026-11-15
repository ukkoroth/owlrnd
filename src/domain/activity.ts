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

export type Bar = { date: string; label: string; count: number; isToday: boolean };

/** The 7-day bar chart: the last 7 days ending today (rules §9). */
export function last7Days(counts: Map<string, number>, today: string): Bar[] {
  return Array.from({ length: rules.activity.barDays }, (_, i) => {
    const date = addDays(today, i - (rules.activity.barDays - 1));
    return { date, label: date === today ? "Today" : dayName(date), count: counts.get(date) ?? 0, isToday: date === today };
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
