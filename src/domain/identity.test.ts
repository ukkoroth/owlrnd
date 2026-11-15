import { describe, expect, it } from "vitest";
import { parseIdentifier, validateEmail, validatePassword, validateUsername } from "./identity";

describe("parseIdentifier", () => {
  it("treats input with @ as a parent email, otherwise a student username, case-insensitively", () => {
    expect(parseIdentifier(" Atticus@Example.com ")).toEqual({ kind: "email", value: "atticus@example.com" });
    expect(parseIdentifier("Scout.F")).toEqual({ kind: "username", value: "scout.f" });
    expect(parseIdentifier("   ")).toBeNull();
  });
});

describe("validatePassword (rules §1: at least 8 characters)", () => {
  it("rejects 7 and accepts 8", () => {
    expect(validatePassword("1234567")).toBe("Use at least 8 characters.");
    expect(validatePassword("12345678")).toBeNull();
  });
});

describe("validateEmail", () => {
  it("needs something@domain.tld", () => {
    expect(validateEmail("")).toBe("Enter your email address.");
    expect(validateEmail("atticus@example")).not.toBeNull();
    expect(validateEmail("atticus@example.com")).toBeNull();
  });
});

describe("validateUsername", () => {
  it("never allows @, so usernames can't be mistaken for emails", () => {
    expect(validateUsername("scout.f")).toBeNull();
    expect(validateUsername("scout@k")).not.toBeNull();
    expect(validateUsername("ag")).not.toBeNull();
  });
});

import { formatClass, validateClassName } from "./identity";

describe("formatClass", () => {
  it("shows a bare number as 'Class N' and never doubles the word", () => {
    expect(formatClass("10")).toBe("Class 10");
    expect(formatClass("Class 10")).toBe("Class 10");
    expect(formatClass("class  8")).toBe("Class 8");
    expect(formatClass("9b")).toBe("Class 9b");
    expect(formatClass("Year 9")).toBe("Year 9");
  });
});

describe("validateClassName", () => {
  it("is required and short", () => {
    expect(validateClassName("  ")).not.toBeNull();
    expect(validateClassName("Class 10")).toBeNull();
    expect(validateClassName("x".repeat(41))).not.toBeNull();
  });
});

describe("validateUsername edge cases", () => {
  it("allows dots, dashes and underscores, but not spaces", () => {
    expect(validateUsername("scout_f-2.b")).toBeNull();
    expect(validateUsername("scout k")).not.toBeNull();
    expect(validateUsername("a".repeat(31))).not.toBeNull();
  });
});
