import { describe, expect, it } from "vitest";
import { controllerOf, holderRef } from "./accounts";

const parent = { id: "p1", name: "Atticus", email: "atticus@example.com", timeZone: "Asia/Kolkata", aiLimitUsd: null };

describe("controllerOf (editions §2.3: who receives sign-in codes)", () => {
  it("a parent-managed learner's holder is their parent", () => {
    const child = { id: "c1", type: "parent_managed" as const, name: "Scout", email: null, timeZone: "UTC", aiLimitUsd: null };
    const h = controllerOf(child, parent);
    expect(h).toMatchObject({ kind: "parent", parentId: "p1", email: "atticus@example.com", timeZone: "Asia/Kolkata" });
    expect(holderRef(h)).toEqual({ parentId: "p1" });
  });

  it("a self-managed learner is their own holder, even if a parent is passed", () => {
    const learner = { id: "s1", type: "self_managed" as const, name: "Jem", email: "jem@example.com", timeZone: "UTC", aiLimitUsd: 25 };
    const h = controllerOf(learner, parent);
    expect(h).toMatchObject({ kind: "learner", studentId: "s1", email: "jem@example.com", aiLimitUsd: 25 });
    expect(holderRef(h)).toEqual({ studentId: "s1" });
  });

  it("refuses impossible rows", () => {
    expect(() => controllerOf({ id: "c1", type: "parent_managed", name: "S", email: null, timeZone: "UTC", aiLimitUsd: null }, null)).toThrow();
    expect(() => controllerOf({ id: "s1", type: "self_managed", name: "J", email: null, timeZone: "UTC", aiLimitUsd: null }, null)).toThrow();
  });
});
