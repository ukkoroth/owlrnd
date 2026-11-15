import { describe, expect, it } from "vitest";
import { goalProgress, goalReached } from "./goals";

describe("goal progress (rules §3)", () => {
  it("counts qualifying exams in a row, newest backwards, and resets on a lower score", () => {
    expect(goalProgress([], 8)).toBe(0);
    expect(goalProgress([9, 8], 8)).toBe(2);
    expect(goalProgress([9, 9, 7], 8)).toBe(0);
    expect(goalProgress([9, 7, 8, 10], 8)).toBe(2);
  });
  it("is reached at N", () => {
    expect(goalReached(goalProgress([8, 9, 10], 8), 3)).toBe(true);
    expect(goalReached(goalProgress([8, 9], 8), 3)).toBe(false);
  });
});
