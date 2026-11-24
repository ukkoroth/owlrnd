import { describe, expect, it } from "vitest";
import { activityGrid, dailyCounts, dailyWritingTime, examWritingTime, formatDuration, last7Days, scoreSummary, type ScoredExam } from "./activity";

describe("activity (rules §9)", () => {
  it("counts exams per day in the student's time zone", () => {
    const at = [new Date("2026-11-14T10:00:00Z"), new Date("2026-11-14T20:00:00Z")];
    expect([...dailyCounts(at, "UTC")]).toEqual([["2026-11-14", 2]]);
    expect([...dailyCounts(at, "Asia/Kolkata")]).toEqual([
      ["2026-11-14", 1],
      ["2026-11-15", 1],
    ]);
  });

  it("7 days end today, today labelled", () => {
    const bars = last7Days(new Map([["2026-11-14", 1], ["2026-11-09", 3]]), "2026-11-14");
    expect(bars.map((b) => b.label)).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Today"]);
    expect(bars.map((b) => b.count)).toEqual([0, 3, 0, 0, 0, 0, 1]);
    expect(bars[6]!.isToday).toBe(true);
  });

  it("the grid is 26 weeks × 7 days with today in the last column, future days empty", () => {
    const g = activityGrid(new Map([["2026-11-14", 5], ["2026-11-10", 2]]), "2026-11-14"); // a Saturday
    expect(g.weeks).toHaveLength(26);
    expect(g.weeks.every((w) => w.length === 7)).toBe(true);
    const last = g.weeks[25]!;
    expect(last[6]).toMatchObject({ date: "2026-11-14", isToday: true, shade: 4, count: 5 }); // 4+ → darkest
    expect(last[2]).toMatchObject({ date: "2026-11-10", shade: 2 });
    expect(g.total).toBe(7);
    expect(g.weeks[0]![0]!.date).toBe("2026-05-17"); // the Sunday 25 weeks before the week of 14 Nov
    expect(g.months.map((m) => m.label)).toEqual(["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"]);
  });

  it("leaves the days after today empty", () => {
    const g = activityGrid(new Map(), "2026-11-11"); // a Wednesday
    expect(g.weeks[25]!.filter((c) => c.future).map((c) => c.date)).toEqual(["2026-11-12", "2026-11-13", "2026-11-14"]);
  });
});

describe("flashcard sessions on the 7-day bars (0.3, F4)", () => {
  it("are their own count per day, separate from exams", async () => {
    const { last7Days } = await import("./activity");
    const bars = last7Days(new Map([["2026-11-16", 2]]), "2026-11-16", new Map([["2026-11-16", 1], ["2026-11-14", 3]]));
    expect(bars.at(-1)).toMatchObject({ count: 2, flashcards: 1, isToday: true });
    expect(bars.at(-3)).toMatchObject({ count: 0, flashcards: 3 });
    expect(last7Days(new Map(), "2026-11-16").every((b) => b.flashcards === 0)).toBe(true);
  });
});

describe("scoreSummary (3d overall chart)", () => {
  const exam = (n: number, trackId: string, score: number): ScoredExam => ({
    id: `e${n}`, trackId, trackName: trackId === "a" ? "Physics" : "Algebra", colorIndex: trackId === "a" ? 0 : 1,
    overallNumber: n, score, submittedAt: new Date(Date.UTC(2026, 10, n)),
  });

  it("is empty without marked exams", () => {
    expect(scoreSummary([])).toEqual({ count: 0, average: 0, recentAverage: null, tracks: [] });
  });

  it("averages to one decimal and gives the latest score per track, most practised first", () => {
    const s = scoreSummary([exam(1, "b", 5), exam(2, "a", 6), exam(3, "a", 7), exam(4, "a", 9)]);
    expect(s.count).toBe(4);
    expect(s.average).toBe(6.8);
    expect(s.tracks).toEqual([
      { trackId: "a", trackName: "Physics", colorIndex: 0, count: 3, average: 7.3, latest: 9 },
      { trackId: "b", trackName: "Algebra", colorIndex: 1, count: 1, average: 5, latest: 5 },
    ]);
  });

  it("gives the last-5 average only once there are more than 5 exams", () => {
    const five = [1, 2, 3, 4, 5].map((n) => exam(n, "a", 4));
    expect(scoreSummary(five).recentAverage).toBeNull();
    expect(scoreSummary([...five, exam(6, "a", 9)]).recentAverage).toBe(5);
  });
});

describe("time spent writing exams (owner, 2026-11-22)", () => {
  const span = (start: string, submit: string) => ({ startedAt: new Date(start), submittedAt: new Date(submit) });

  it("sums start-to-submit per day of submission, in the student's time zone", () => {
    const spans = [
      span("2026-11-14T10:00:00Z", "2026-11-14T10:12:00Z"),
      span("2026-11-14T20:00:00Z", "2026-11-14T20:08:30Z"),
      { startedAt: null, submittedAt: new Date("2026-11-14T21:00:00Z") },
    ];
    expect([...dailyWritingTime(spans, "UTC")]).toEqual([["2026-11-14", 20.5 * 60_000]]);
    expect([...dailyWritingTime(spans, "Asia/Kolkata")]).toEqual([
      ["2026-11-14", 12 * 60_000],
      ["2026-11-15", 8.5 * 60_000],
    ]);
  });

  it("counts an exam that crosses midnight on the day it was submitted", () => {
    expect([...dailyWritingTime([span("2026-11-14T23:55:00Z", "2026-11-15T00:05:00Z")], "UTC")]).toEqual([["2026-11-15", 10 * 60_000]]);
  });

  it("caps each idle gap, so a paper left open overnight counts only the time it was worked on (owner, 2026-11-24)", () => {
    // Started at 19:00, answered for 10 minutes, left open, submitted at 18:00 the next day.
    const overnight = {
      startedAt: new Date("2026-11-23T19:00:00Z"),
      answeredAt: [new Date("2026-11-23T19:04:00Z"), new Date("2026-11-23T19:10:00Z")],
      submittedAt: new Date("2026-11-24T18:00:00Z"),
    };
    expect(examWritingTime(overnight)).toBe((10 + 15) * 60_000);
    expect([...dailyWritingTime([overnight], "UTC")]).toEqual([["2026-11-24", 25 * 60_000]]);
  });

  it("counts a steady paper in full, whatever order the answers were saved in", () => {
    const steady = {
      startedAt: new Date("2026-11-24T10:00:00Z"),
      answeredAt: [new Date("2026-11-24T10:24:00Z"), new Date("2026-11-24T10:12:00Z"), new Date("2026-11-24T10:36:00Z")],
      submittedAt: new Date("2026-11-24T10:40:00Z"),
    };
    expect(examWritingTime(steady)).toBe(40 * 60_000);
    expect(examWritingTime({ startedAt: null, submittedAt: steady.submittedAt })).toBe(0);
  });

  it("formats durations", () => {
    expect(formatDuration(0)).toBe("under a minute");
    expect(formatDuration(29_000)).toBe("under a minute");
    expect(formatDuration(34 * 60_000)).toBe("34 min");
    expect(formatDuration(60 * 60_000)).toBe("1 hr");
    expect(formatDuration(65 * 60_000)).toBe("1 hr 5 min");
  });
});
