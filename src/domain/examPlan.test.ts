import { describe, expect, it } from "vitest";
import { firstExamPlan, validateWrittenExam, type PlanSlot, type WrittenQuestion } from "./examPlan";

const keys = (n: number) => Array.from({ length: n }, (_, i) => `T${i + 1}`);
const countBy = (plan: PlanSlot[], f: (s: PlanSlot) => string) => plan.reduce<Record<string, number>>((m, s) => ((m[f(s)] = (m[f(s)] ?? 0) + 1), m), {});

describe("firstExamPlan (rules §4: first exam covers every topic about evenly)", () => {
  it.each([1, 3, 5, 7, 10])("spreads 10 questions over %i topics within one of each other", (n) => {
    const plan = firstExamPlan(keys(n));
    expect(plan).toHaveLength(10);
    const perTopic = Object.values(countBy(plan, (s) => s.topicKey));
    expect(perTopic).toHaveLength(n);
    expect(Math.max(...perTopic) - Math.min(...perTopic)).toBeLessThanOrEqual(1);
  });

  it("with 12 topics, uses 10 of them once each (never more than 10 questions)", () => {
    const plan = firstExamPlan(keys(12));
    expect(plan).toHaveLength(10);
    expect(new Set(plan.map((s) => s.topicKey)).size).toBe(10);
  });

  it("is at least half multiple choice, and puts multiple choice first", () => {
    for (const n of [1, 3, 5, 7]) {
      const plan = firstExamPlan(keys(n));
      const mcq = plan.filter((s) => s.type === "multiple_choice").length;
      expect(mcq).toBeGreaterThanOrEqual(5);
      const firstShort = plan.findIndex((s) => s.type === "short");
      expect(plan.slice(firstShort).every((s) => s.type === "short")).toBe(true);
    }
  });

  it("gives each topic a mix of types when it has 2+ questions", () => {
    const plan = firstExamPlan(keys(3));
    for (const k of keys(3)) {
      const types = new Set(plan.filter((s) => s.topicKey === k).map((s) => s.type));
      expect(types.size).toBe(2);
    }
  });

  it("is empty without topics", () => {
    expect(firstExamPlan([])).toEqual([]);
  });
});

describe("validateWrittenExam (AI §3 checks)", () => {
  const plan: PlanSlot[] = [
    { topicKey: "T1", type: "multiple_choice" },
    { topicKey: "T2", type: "short" },
  ];
  const mcq: WrittenQuestion = {
    topicKey: "T1",
    type: "multiple_choice",
    prompt: "What is the unit of resistance?",
    options: ["Ohm", "Volt", "Ampere", "Watt"],
    correctIndex: 0,
    expectedAnswer: null,
    explanation: "Resistance is measured in ohms.",
    difficulty: 1,
  };
  const short: WrittenQuestion = {
    topicKey: "T2",
    type: "short",
    prompt: "State Ohm's law.",
    options: [],
    correctIndex: null,
    expectedAnswer: "Current is proportional to voltage at constant temperature.",
    explanation: "V = IR.",
    difficulty: 2,
  };

  it("accepts a paper that matches the plan", () => {
    expect(validateWrittenExam(plan, [mcq, short])).toEqual([]);
  });

  it("catches bad options, unknown topics, wrong mix and missing answers", () => {
    expect(validateWrittenExam(plan, [{ ...mcq, options: ["Ohm", "Volt", "Ampere"] }, short]).join(" ")).toContain("exactly 4");
    expect(validateWrittenExam(plan, [{ ...mcq, options: ["Ohm", "ohm", "Volt", "Watt"] }, short]).join(" ")).toContain("different");
    expect(validateWrittenExam(plan, [{ ...mcq, correctIndex: 4 }, short]).join(" ")).toContain("correctIndex");
    expect(validateWrittenExam(plan, [{ ...mcq, topicKey: "T9" }, short]).join(" ")).toContain("not one of this exam's topics");
    expect(validateWrittenExam(plan, [mcq, { ...short, expectedAnswer: "" }]).join(" ")).toContain("expected answer");
    expect(validateWrittenExam(plan, [mcq, mcq]).join(" ")).toContain("too many");
    expect(validateWrittenExam(plan, [mcq]).join(" ")).toContain("Expected 2 questions");
    expect(validateWrittenExam(plan, [mcq, short], ["  what is the UNIT of resistance? "]).join(" ")).toContain("repeats a question");
  });
});
