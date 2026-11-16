import { describe, expect, it } from "vitest";
import { ageOn, parseDateOfBirth, parseIdentifier, validateEmail, validatePassword, validateUsername } from "./identity";

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

describe("ageOn", () => {
  it("counts whole years, turning older on the birthday", () => {
    expect(ageOn("2008-11-16", "2026-11-15")).toBe(17); // the day before the 18th birthday
    expect(ageOn("2008-11-16", "2026-11-16")).toBe(18);
  });
  it("someone born on 29 February is a year older from 1 March in other years", () => {
    expect(ageOn("2008-02-29", "2026-02-28")).toBe(17);
    expect(ageOn("2008-02-29", "2026-03-01")).toBe(18);
    expect(ageOn("2008-02-29", "2028-02-29")).toBe(20);
  });
});

describe("parseDateOfBirth", () => {
  const today = "2026-11-16";
  const range = { min: 5, max: 120 };
  const dob = (day: string, month: string, year: string) => parseDateOfBirth({ day, month, year }, today, range);

  it("accepts a real date and gives the age", () => {
    expect(dob("12", "3", "2009")).toEqual({ ok: true, iso: "2009-03-12", age: 17 });
    expect(dob("29", "2", "2008")).toMatchObject({ ok: true, iso: "2008-02-29" });
  });
  it("refuses missing, malformed and impossible dates", () => {
    expect(dob("", "3", "2009")).toMatchObject({ ok: false, error: "Enter the full date of birth." });
    expect(dob("31", "4", "2009")).toMatchObject({ ok: false });
    expect(dob("29", "2", "2009")).toMatchObject({ ok: false });
    expect(dob("12", "13", "2009")).toMatchObject({ ok: false });
    expect(dob("12", "3", "09")).toMatchObject({ ok: false });
  });
  it("refuses the future and ages outside the range", () => {
    expect(dob("17", "11", "2026")).toMatchObject({ ok: false, error: "The date of birth can't be in the future." });
    expect(dob("16", "11", "2022")).toMatchObject({ ok: false }); // 4
    expect(dob("16", "11", "2021")).toMatchObject({ ok: true }); // 5
    expect(dob("1", "1", "1900")).toMatchObject({ ok: false });
  });
});
