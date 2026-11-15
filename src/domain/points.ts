import { rules } from "@/config/rules";

export type PointsKind = "finish" | "correct" | "improvement" | "topic_strong" | "perfect" | "streak";
export type PointsLine = { kind: PointsKind; points: number; label: string };

export type ExamPointsInput = {
  correct: number;
  /** Correct answers in the previous marked exam of the same track, if any. */
  previousCorrect: number | null;
  /** Topics that went from needs work to strong with this exam. */
  topicsNowStrong: string[];
  perfect: boolean;
  /** Exams the student already finished earlier the same day (in their time zone). */
  examsEarlierToday: number;
  /** Did the student also practise the day before? */
  practisedYesterday: boolean;
  /** Days in the unbroken practice streak, counting today. */
  streakDay: number;
};

/**
 * Rules §8. Points reward effort and improvement; they only add up. Full points for the first 5 exams a day;
 * after that only correct answers score. Worked example: 8 / 10, up from 6, day 4 of a streak = 41.
 */
export function examPoints(i: ExamPointsInput): PointsLine[] {
  const p = rules.points;
  const lines: PointsLine[] = [];
  const full = i.examsEarlierToday < p.fullPointsExamsPerDay;

  if (full) lines.push({ kind: "finish", points: p.finishExam, label: "Finished the exam" });
  if (i.correct > 0) {
    lines.push({
      kind: "correct",
      points: Math.min(i.correct * p.perCorrect, p.perCorrectCap),
      label: `${i.correct} correct ${i.correct === 1 ? "answer" : "answers"}, ${p.perCorrect} points each`,
    });
  }
  if (!full) return lines;

  const better = i.previousCorrect === null ? 0 : i.correct - i.previousCorrect;
  if (better > 0) lines.push({ kind: "improvement", points: better * p.perExtraCorrectVsLast, label: `Beat your last score in this track by ${better}` });
  for (const name of i.topicsNowStrong) lines.push({ kind: "topic_strong", points: p.weakTopicBecomesStrong, label: `${name} is now strong` });
  if (i.perfect) lines.push({ kind: "perfect", points: p.perfectBonus, label: "A perfect 10 / 10" });
  if (i.examsEarlierToday === 0 && i.practisedYesterday) {
    const long = i.streakDay >= p.streak.fromDay;
    lines.push({ kind: "streak", points: long ? p.streak.firstExamOfDayLong : p.streak.firstExamOfDay, label: `Practised ${i.streakDay} days in a row` });
  }
  return lines;
}

export const totalOf = (lines: { points: number }[]) => lines.reduce((s, l) => s + l.points, 0);

/** ISO date `n` days after `iso` (calendar arithmetic, no time zones involved). */
export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Days in the unbroken run of practice days ending on `today` (0 if there was no practice today). */
export function streakDays(practiceDays: Set<string>, today: string): number {
  let n = 0;
  for (let d = today; practiceDays.has(d); d = addDays(d, -1)) n++;
  return n;
}

export type PointsEventLike = { kind: PointsKind; points: number; label: string; createdAt: Date };

const lead = (label: string) => Number(label.match(/^\d+/)?.[0] ?? 0);
const after = (label: string) => Number(label.match(/(\d+)\D*$/)?.[1] ?? 0);

/** 4.3a "Earned today": today's events grouped into one line per kind, in the student's time zone. */
export function todaysBreakdown(events: PointsEventLike[], today: string, dayOf: (d: Date) => string) {
  const todays = events.filter((e) => dayOf(e.createdAt) === today);
  const sumOf = (k: PointsKind) => todays.filter((e) => e.kind === k);
  const lines: { label: string; points: number }[] = [];
  const add = (k: PointsKind, label: (es: PointsEventLike[]) => string) => {
    const es = sumOf(k);
    if (es.length) lines.push({ label: label(es), points: es.reduce((s, e) => s + e.points, 0) });
  };
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  add("finish", (es) => `Finished ${plural(es.length, "exam", "exams")}`);
  add("correct", (es) => plural(es.reduce((s, e) => s + lead(e.label), 0), "correct answer", "correct answers"));
  add("improvement", (es) => `Beat your last score by ${es.reduce((s, e) => s + after(e.label), 0)}`);
  add("topic_strong", (es) => `${plural(es.length, "weak topic", "weak topics")} became strong`);
  add("perfect", (es) => plural(es.length, "perfect 10 / 10", "perfect 10 / 10s"));
  add("streak", (es) => `${Math.max(...es.map((e) => lead(e.label.replace(/^\D+/, ""))))} days in a row`);
  return { lines, total: lines.reduce((s, l) => s + l.points, 0) };
}
