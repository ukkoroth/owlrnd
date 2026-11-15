import { describe, expect, it } from "vitest";
import { canSendCode, checkCodeAttempt, codeExpiry, generateCode, initialTries, maskEmail, normalizeCodeInput, type CodeState } from "./codes";

const issued = new Date("2026-11-14T10:00:00Z");
const fresh = (over: Partial<CodeState> = {}): CodeState => ({
  expiresAt: codeExpiry(issued),
  triesLeft: initialTries,
  usedAt: null,
  invalidatedAt: null,
  ...over,
});
const at = (minutes: number) => new Date(issued.getTime() + minutes * 60_000);

describe("generateCode", () => {
  it("is always 6 digits, keeping leading zeros", () => {
    expect(generateCode(() => 42)).toBe("000042");
    expect(generateCode((max) => max - 1)).toBe("999999");
  });
});

describe("normalizeCodeInput", () => {
  it("accepts spaces and dashes, rejects anything not 6 digits", () => {
    expect(normalizeCodeInput("482 913")).toBe("482913");
    expect(normalizeCodeInput("482-913")).toBe("482913");
    expect(normalizeCodeInput("48291")).toBeNull();
    expect(normalizeCodeInput("48291a")).toBeNull();
    expect(normalizeCodeInput("4829130")).toBeNull();
  });
});

describe("maskEmail (screen 3b)", () => {
  it("keeps the first letter and the domain", () => {
    expect(maskEmail("atticus@example.com")).toBe("a•••@example.com");
    expect(maskEmail("a@b.co")).toBe("a•••@b.co");
  });
});

describe("checkCodeAttempt (rules §1)", () => {
  it("accepts the right code within 10 minutes", () => {
    expect(checkCodeAttempt(fresh(), true, at(9.99))).toEqual({ result: "ok" });
  });

  it("expires at exactly 10 minutes, even for the right code", () => {
    expect(checkCodeAttempt(fresh(), true, at(10))).toEqual({ result: "expired" });
  });

  it("counts wrong tries down 2, 1, then locks on the 3rd (screen 5f)", () => {
    let state = fresh();
    const first = checkCodeAttempt(state, false, at(1));
    expect(first).toEqual({ result: "wrong", triesLeft: 2 });
    state = { ...state, triesLeft: 2 };
    expect(checkCodeAttempt(state, false, at(2))).toEqual({ result: "wrong", triesLeft: 1 });
    state = { ...state, triesLeft: 1 };
    expect(checkCodeAttempt(state, false, at(3))).toEqual({ result: "locked" });
  });

  it("still accepts the right code on the last try", () => {
    expect(checkCodeAttempt(fresh({ triesLeft: 1 }), true, at(3))).toEqual({ result: "ok" });
  });

  it("is single use", () => {
    expect(checkCodeAttempt(fresh({ usedAt: at(1) }), true, at(2))).toEqual({ result: "used" });
  });

  it("rejects a code replaced by a newer one", () => {
    expect(checkCodeAttempt(fresh({ invalidatedAt: at(1) }), true, at(2))).toEqual({ result: "invalidated" });
  });
});

describe("canSendCode (5 per hour)", () => {
  it("allows the 5th send and refuses the 6th", () => {
    expect(canSendCode(4)).toBe(true);
    expect(canSendCode(5)).toBe(false);
  });
});
