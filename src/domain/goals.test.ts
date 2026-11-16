import { describe, expect, it } from "vitest";
import { coverageMet, goalProgress, goalReached, topicCoverage, type CoverageTopic } from "./goals";

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

describe("goal coverage (rules §3, 0.2)", () => {
  const t = (strength: CoverageTopic["strength"], revisionOnly = false): CoverageTopic => ({ strength, revisionOnly });

  it("a full run with one topic needing work is not reached", () => {
    const topics = [t("strong"), t("strong"), t("needs_work")];
    expect(goalReached(3, 3, coverageMet(topics, "all_strong"))).toBe(false);
  });
  it("every topic strong but a run of 2 of 3 is not reached; both is", () => {
    const topics = [t("strong"), t("strong")];
    expect(goalReached(2, 3, coverageMet(topics, "all_strong"))).toBe(false);
    expect(goalReached(3, 3, coverageMet(topics, "all_strong"))).toBe(true);
  });
  it("revision topics after a restart don't count", () => {
    const topics = [t("strong"), t("needs_work", true), t("not_tested", true)];
    expect(coverageMet(topics, "all_strong")).toBe(true);
    expect(topicCoverage(topics)).toEqual({ strong: 1, total: 1 });
  });
  it("'all_tested' needs every topic tested and none needing work; 'off' is the 0.1 rule", () => {
    expect(coverageMet([t("strong"), t("not_tested")], "all_tested")).toBe(false);
    expect(coverageMet([t("strong"), t("needs_work")], "all_tested")).toBe(false);
    expect(coverageMet([t("strong"), t("strong")], "all_tested")).toBe(true);
    expect(coverageMet([t("needs_work"), t("not_tested")], "off")).toBe(true);
  });
});
