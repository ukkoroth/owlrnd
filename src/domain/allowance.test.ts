import { describe, expect, it } from "vitest";
import { allowanceState, formatUsd } from "./allowance";

describe("allowanceState", () => {
  it("is ok below 80%, warns from 80%, is used up at 100%", () => {
    expect(allowanceState(3.2, 10)).toMatchObject({ percent: 32, level: "ok", usedUp: false });
    expect(allowanceState(7.99, 10)).toMatchObject({ level: "ok" });
    expect(allowanceState(8, 10)).toMatchObject({ percent: 80, level: "warn", usedUp: false });
    expect(allowanceState(10, 10)).toMatchObject({ percent: 100, level: "used_up", usedUp: true });
    expect(allowanceState(12.5, 10)).toMatchObject({ percent: 100, usedUp: true });
  });

  it("a raised limit lifts the block", () => {
    expect(allowanceState(10, 25)).toMatchObject({ percent: 40, level: "ok", usedUp: false });
  });
});

describe("formatUsd", () => {
  it("drops cents only for whole dollars", () => {
    expect(formatUsd(10)).toBe("$10");
    expect(formatUsd(3.2)).toBe("$3.20");
    expect(formatUsd(0)).toBe("$0");
  });
});
