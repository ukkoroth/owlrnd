import { describe, expect, it } from "vitest";
import type { AnswerValue, PaperQuestion } from "./exam";
import { blockMessage, looksLikeMash, submitBlock } from "./rushGuard";

const guard = { minAnsweredShare: 0.5, minSecondsPerAnswer: 10 };
const paper: PaperQuestion[] = [...Array(10)].map((_, i) => ({ id: `q${i + 1}`, type: i < 5 ? "multiple_choice" : "short" }));
const mc = (o: number): AnswerValue => ({ chosenOption: o, text: null });
const typed = (t: string): AnswerValue => ({ chosenOption: null, text: t });
const start = new Date("2026-11-26T11:00:00Z");
const after = (s: number) => new Date(start.getTime() + s * 1000);

describe("looksLikeMash", () => {
  // Real answers from a rushed paper on 2026-11-26.
  it.each(["pojwecxnwdc", "cqwofbcq3", "qwfciewondcveh", "apwifncewalfsoiweanfcpoiwrgnjc3w pi3hrjfnvw3oih3bo", "gtyrvjfucdeioktgyhrfjiedfbhdnjxwkzfrvfbecdxwhnsjim", "oowieiiwiiwowiwoieoiwieeeeooeooooeoeoeoeoeoeoeoeoe"])(
    "flags %s",
    (t) => expect(looksLikeMash(t)).toBe(true),
  );

  it.each([
    "(4m^2 + 25n^2)(2m + 5n)(2m - 5n)",
    "4a^2b^2(2a - 3b + 1)",
    "13x^2y^3",
    "5pqr(3p - q)",
    "2.25 × 10^8 m/s",
    "Away from the normal",
    "Dispersion of light",
    "It bends towards the normal because light slows down in glass",
    "The image becomes smaller as the car moves away",
    "Factorisation",
    "No, factorisation is the reverse of multiplication",
    "lengths and strengths of the instrument",
    "photosynthesis",
    "Counterclockwise",
    "x + 1",
    "",
  ])("accepts %s", (t) => expect(looksLikeMash(t)).toBe(false));
});

describe("submitBlock", () => {
  const five = { q1: mc(0), q2: mc(1), q3: mc(2), q6: typed("x + 1"), q7: typed("Away from the normal") };

  it("blocks an empty paper", () => {
    expect(submitBlock(paper, {}, start, after(600), guard)).toEqual({ reason: "too_few", needed: 5, answered: 0, mash: [] });
  });

  it("doesn't count mash as answered and names those questions", () => {
    const answers = { q1: mc(0), q2: mc(1), q6: typed("pojwecxnwdc"), q7: typed("cqwofbcq3"), q8: typed("x + 1") };
    expect(submitBlock(paper, answers, start, after(600), guard)).toEqual({ reason: "too_few", needed: 5, answered: 3, mash: [6, 7] });
  });

  it("blocks a paper handed in faster than the time per answer", () => {
    expect(submitBlock(paper, five, start, after(30), guard)).toEqual({ reason: "too_fast", waitSeconds: 20 });
  });

  it("lets a real attempt through", () => {
    expect(submitBlock(paper, five, start, after(50), guard)).toBeNull();
    const full = Object.fromEntries(paper.map((q) => [q.id, q.type === "short" ? typed("x + 1") : mc(0)]));
    expect(submitBlock(paper, full, start, after(100), guard)).toBeNull();
  });

  it("skips the time check when the start time is unknown", () => {
    expect(submitBlock(paper, five, null, after(1), guard)).toBeNull();
  });
});

describe("blockMessage", () => {
  it("explains each block", () => {
    expect(blockMessage({ reason: "too_fast", waitSeconds: 1 }).body).toContain("in 1 second.");
    expect(blockMessage({ reason: "too_few", needed: 5, answered: 3, mash: [6, 7] }).body).toContain("Questions 6 and 7 look like random typing, so they don't count.");
    expect(blockMessage({ reason: "too_few", needed: 5, answered: 0, mash: [] }).title).toBe("Answer at least 5 questions");
  });
});
