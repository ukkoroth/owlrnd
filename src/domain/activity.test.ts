import { describe, expect, it } from "vitest";
import { activityGrid, dailyCounts, last7Days } from "./activity";

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
