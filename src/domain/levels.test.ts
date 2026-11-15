import { describe, expect, it } from "vitest";
import { levelFor } from "./levels";

describe("levelFor (rules §8)", () => {
  it("has no level before 500 points; first level at 500 (screen 3f)", () => {
    expect(levelFor(0)).toEqual({ current: null, next: { name: "Explorer", at: 500, pointsToGo: 500 } });
    expect(levelFor(499).current).toBeNull();
    expect(levelFor(500).current).toBe("Explorer");
  });

  it("matches the sidebar sample: 5,640 points is Champion", () => {
    expect(levelFor(5_640)).toEqual({ current: "Champion", next: { name: "Mastermind", at: 10_000, pointsToGo: 4_360 } });
  });

  it("has no next level at the top", () => {
    expect(levelFor(25_000)).toEqual({ current: "All-rounder", next: null });
  });
});
