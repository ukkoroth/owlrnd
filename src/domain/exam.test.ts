import { describe, expect, it } from "vitest";
import { blankQuestions, blankSentence } from "./exam";

describe("blankQuestions (4.1c)", () => {
  const qs = [
    { id: "a", type: "multiple_choice" as const },
    { id: "b", type: "short" as const },
    { id: "c", type: "short" as const },
  ];
  it("treats unchosen options and empty or whitespace text as blank", () => {
    expect(blankQuestions(qs, { a: { chosenOption: 2, text: null }, b: { chosenOption: null, text: "  " } })).toEqual([2, 3]);
    expect(blankQuestions(qs, { a: { chosenOption: 0, text: null }, b: { chosenOption: null, text: "ohm" }, c: { chosenOption: null, text: "x" } })).toEqual([]);
  });
  it("names the blank questions like the mockup", () => {
    expect(blankSentence([8])).toBe("Question 8 is blank.");
    expect(blankSentence([8, 10])).toBe("Questions 8 and 10 are blank.");
    expect(blankSentence([3, 5, 8])).toBe("Questions 3, 5 and 8 are blank.");
  });
});
