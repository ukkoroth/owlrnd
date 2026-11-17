import { describe, expect, it } from "vitest";
import { rules } from "@/config/rules";
import { examHoldNote, type ExamHold } from "./examHold";

describe("examHoldNote", () => {
  it("tells the account holder their allowance is used up and how to carry on", () => {
    expect(examHoldNote("allowance", "holder")).toMatch(/your AI allowance is used up.*buy a package/);
  });

  it("sends a child to their parent when the parent's allowance is used up", () => {
    expect(examHoldNote("allowance", "child")).toMatch(/your parent's AI allowance.*Ask your parent/);
  });

  it("names the daily limit from the rules", () => {
    expect(examHoldNote("daily_limit", "holder")).toContain(`${rules.aiLimits.examsWrittenPerDay} new exams`);
  });

  it("has a line for every hold and viewer", () => {
    for (const hold of ["allowance", "daily_limit", "budget", "consent"] as ExamHold[])
      for (const viewer of ["holder", "child"] as const) expect(examHoldNote(hold, viewer)).toMatch(/^On hold/);
  });
});
