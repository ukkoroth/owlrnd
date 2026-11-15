import { describe, expect, it } from "vitest";
import { examTopicSummary, strengthOf } from "./topicStrength";

const R = true, W = false;

describe("strengthOf (rules §4 + owner decision)", () => {
  it("is not tested with no answers, or 1–2 answers all right", () => {
    expect(strengthOf([])).toBe("not_tested");
    expect(strengthOf([R])).toBe("not_tested");
    expect(strengthOf([R, R])).toBe("not_tested");
  });
  it("needs work after any miss, until strong", () => {
    expect(strengthOf([W])).toBe("needs_work");
    expect(strengthOf([R, W])).toBe("needs_work");
    expect(strengthOf([R, R, W])).toBe("needs_work"); // 67%
  });
  it("is strong at 80% or more of the last 5, with at least 3 answered", () => {
    expect(strengthOf([R, R, R])).toBe("strong");
    expect(strengthOf([R, W, R, R, R])).toBe("strong"); // 4 of 5
    expect(strengthOf([W, W, R, R, R, R, R])).toBe("strong"); // only the last 5 count
    expect(strengthOf([R, R, R, W, W])).toBe("needs_work"); // 3 of 5
  });
});

describe("examTopicSummary (4.1e)", () => {
  it("splits this exam's topics into strengths and needs work", () => {
    const out = examTopicSummary([
      { topicId: "a", name: "Ohm's law", correct: true },
      { topicId: "a", name: "Ohm's law", correct: true },
      { topicId: "b", name: "Parallel", correct: false },
      { topicId: "c", name: "Power", correct: true },
      { topicId: "c", name: "Power", correct: false },
    ]);
    expect(out.strengths).toEqual([{ topicId: "a", name: "Ohm's law", right: 2, total: 2 }]);
    expect(out.needsWork.map((t) => `${t.name} ${t.right} of ${t.total}`)).toEqual(["Parallel 0 of 1", "Power 1 of 2"]);
  });
});
