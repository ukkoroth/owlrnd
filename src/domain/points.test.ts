import { describe, expect, it } from "vitest";
import { addDays, examPoints, streakDays, totalOf, type ExamPointsInput } from "./points";

const base: ExamPointsInput = { correct: 0, previousCorrect: null, topicsNowStrong: [], perfect: false, examsEarlierToday: 0, practisedYesterday: false, streakDay: 1 };

describe("examPoints (rules §8)", () => {
  it("matches the worked example: 8 / 10, up from 6, day 4 of a streak = 41", () => {
    const lines = examPoints({ ...base, correct: 8, previousCorrect: 6, practisedYesterday: true, streakDay: 4 });
    expect(lines.map((l) => [l.label, l.points])).toEqual([
      ["Finished the exam", 10],
      ["8 correct answers, 2 points each", 16],
      ["Beat your last score in this track by 2", 10],
      ["Practised 4 days in a row", 5],
    ]);
    expect(totalOf(lines)).toBe(41);
  });

  it("caps correct answers at 20 and adds the perfect and weak-to-strong bonuses", () => {
    const lines = examPoints({ ...base, correct: 10, previousCorrect: 10, perfect: true, topicsNowStrong: ["Ohm's law", "Power"] });
    expect(lines.find((l) => l.kind === "correct")!.points).toBe(20);
    expect(lines.filter((l) => l.kind === "topic_strong").map((l) => l.points)).toEqual([10, 10]);
    expect(lines.find((l) => l.kind === "perfect")!.points).toBe(10);
    expect(lines.some((l) => l.kind === "improvement")).toBe(false); // same as last time
    expect(totalOf(lines)).toBe(10 + 20 + 20 + 10);
  });

  it("gives no improvement points for a first exam or a lower score", () => {
    expect(examPoints({ ...base, correct: 5 }).some((l) => l.kind === "improvement")).toBe(false);
    expect(examPoints({ ...base, correct: 5, previousCorrect: 7 }).some((l) => l.kind === "improvement")).toBe(false);
  });

  it("streak: only on the first exam of the day after practising yesterday; 10 from day 7", () => {
    expect(examPoints({ ...base, practisedYesterday: false }).some((l) => l.kind === "streak")).toBe(false);
    expect(examPoints({ ...base, practisedYesterday: true, examsEarlierToday: 1, streakDay: 3 }).some((l) => l.kind === "streak")).toBe(false);
    expect(examPoints({ ...base, practisedYesterday: true, streakDay: 6 }).find((l) => l.kind === "streak")!.points).toBe(5);
    expect(examPoints({ ...base, practisedYesterday: true, streakDay: 7 }).find((l) => l.kind === "streak")!.points).toBe(10);
  });

  it("after 5 exams in a day, only correct answers score", () => {
    const lines = examPoints({ ...base, correct: 10, previousCorrect: 5, perfect: true, examsEarlierToday: 5, topicsNowStrong: ["x"] });
    expect(lines.map((l) => l.kind)).toEqual(["correct"]);
  });
});

describe("streakDays", () => {
  it("counts the unbroken run ending today", () => {
    const days = new Set(["2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-09"]);
    expect(streakDays(days, "2026-11-14")).toBe(4);
    expect(streakDays(days, "2026-11-15")).toBe(0);
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

import { todaysBreakdown } from "./points";
import { levelProgress } from "./levels";

describe("todaysBreakdown (4.3a)", () => {
  it("groups today's events like the mockup", () => {
    const today = new Date("2026-11-14T10:00:00Z");
    const yesterday = new Date("2026-11-13T10:00:00Z");
    const ev = [
      { kind: "finish" as const, points: 10, label: "Finished the exam", createdAt: today },
      { kind: "correct" as const, points: 16, label: "8 correct answers, 2 points each", createdAt: today },
      { kind: "improvement" as const, points: 10, label: "Beat your last score in this track by 2", createdAt: today },
      { kind: "streak" as const, points: 5, label: "Practised 4 days in a row", createdAt: today },
      { kind: "finish" as const, points: 10, label: "Finished the exam", createdAt: yesterday },
    ];
    const out = todaysBreakdown(ev, "2026-11-14", (d) => d.toISOString().slice(0, 10));
    expect(out.lines).toEqual([
      { label: "Finished 1 exam", points: 10 },
      { label: "8 correct answers", points: 16 },
      { label: "Beat your last score by 2", points: 10 },
      { label: "4 days in a row", points: 5 },
    ]);
    expect(out.total).toBe(41);
  });
});

describe("levelProgress (4.3a)", () => {
  it("shows the way to the next level", () => {
    expect(levelProgress(0)).toMatchObject({ current: null, next: { name: "Explorer", pointsToGo: 500 }, share: 0 });
    expect(levelProgress(499).share).toBeCloseTo(0.998);
    expect(levelProgress(500)).toMatchObject({ current: "Explorer", share: 0 });
    expect(levelProgress(5_640)).toMatchObject({ current: "Champion", next: { name: "Mastermind", pointsToGo: 4_360 } });
    expect(levelProgress(5_640).share).toBeCloseTo(0.128);
    expect(levelProgress(25_000)).toMatchObject({ current: "All-rounder", next: null, share: 1 });
  });
});
