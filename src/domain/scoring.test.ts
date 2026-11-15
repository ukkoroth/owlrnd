import { describe, expect, it } from "vitest";
import { exactMatch, scoreOutOf10 } from "./scoring";

describe("scoreOutOf10 (rules §6)", () => {
  it("scales marks to 10 and rounds", () => {
    expect(scoreOutOf10(8, 10)).toBe(8);
    expect(scoreOutOf10(7, 9)).toBe(8); // 7.78
    expect(scoreOutOf10(5, 9)).toBe(6); // 5.56
    expect(scoreOutOf10(0, 10)).toBe(0);
    expect(scoreOutOf10(0, 0)).toBe(0);
  });
});

describe("exactMatch (skips the AI for identical answers)", () => {
  it("ignores case, spaces and punctuation", () => {
    expect(exactMatch("Ohm's law", "ohms law")).toBe(true);
    expect(exactMatch("10 V", "10V")).toBe(true);
    expect(exactMatch("0.25 A", "0.25 a")).toBe(true);
    expect(exactMatch("Kilowatt-hour", "kilowatt hour.")).toBe(true);
  });
  it("is strict otherwise, and never matches a blank", () => {
    expect(exactMatch("0.25 A", "0.5 A")).toBe(false);
    expect(exactMatch("2.5 Ω", "25 Ω")).toBe(false);
    expect(exactMatch("Ohm's law", "  ")).toBe(false);
  });
});
