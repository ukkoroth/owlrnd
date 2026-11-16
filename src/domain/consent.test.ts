import { describe, expect, it } from "vitest";
import { consentState, needsConsent, practiceAllowed } from "./consent";

const T0 = new Date("2026-11-16T09:00:00Z");
const days = (n: number) => new Date(T0.getTime() + n * 24 * 60 * 60_000);
const req = (status: "pending" | "agreed" | "declined" | "expired", at = T0) => ({ status, createdAt: at });

describe("needsConsent (under 18)", () => {
  it("is needed the day before the 18th birthday, not on it", () => {
    expect(needsConsent("2008-11-17", "2026-11-16")).toBe(true);
    expect(needsConsent("2008-11-16", "2026-11-16")).toBe(false);
    expect(needsConsent(null, "2026-11-16")).toBe(false);
  });
});

describe("consentState", () => {
  it("adults don't need it", () => expect(consentState(false, null, null, T0)).toBe("not_needed"));
  it("pending until answered; not asked yet also counts as pending", () => {
    expect(consentState(true, null, null, T0)).toBe("pending");
    expect(consentState(true, req("pending"), req("pending"), days(29))).toBe("pending");
  });
  it("overdue after 30 days, counted from the first request even if a new link was sent", () => {
    expect(consentState(true, req("pending"), req("pending"), days(30.01))).toBe("overdue");
    expect(consentState(true, req("pending", days(20)), req("expired"), days(31))).toBe("overdue");
  });
  it("the latest answer wins", () => {
    expect(consentState(true, req("agreed"), req("expired"), days(90))).toBe("agreed");
    expect(consentState(true, req("declined"), req("pending"), days(1))).toBe("declined");
  });
});

describe("practiceAllowed", () => {
  it("practise while pending (owner's default), or block until consent", () => {
    expect(practiceAllowed("pending", "practise_while_pending")).toBe(true);
    expect(practiceAllowed("pending", "block_until_consent")).toBe(false);
    for (const mode of ["practise_while_pending", "block_until_consent"] as const) {
      expect(practiceAllowed("agreed", mode)).toBe(true);
      expect(practiceAllowed("not_needed", mode)).toBe(true);
      expect(practiceAllowed("overdue", mode)).toBe(false);
      expect(practiceAllowed("declined", mode)).toBe(false);
    }
  });
});
