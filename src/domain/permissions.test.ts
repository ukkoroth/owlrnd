import { describe, expect, it } from "vitest";
import { can, type Action, type Actor, type LearnerRef } from "./permissions";

// Editions §2.3, cell by cell.
const parent: Actor = { kind: "parent", parentId: "p1" };
const otherParent: Actor = { kind: "parent", parentId: "p2" };
const child: LearnerRef = { id: "c1", type: "parent_managed", parentId: "p1" };
const childActor: Actor = { kind: "learner", studentId: "c1", type: "parent_managed", parentId: "p1" };
const sibling: LearnerRef = { id: "c2", type: "parent_managed", parentId: "p1" };
const self: LearnerRef = { id: "s1", type: "self_managed", parentId: null };
const selfActor: Actor = { kind: "learner", studentId: "s1", type: "self_managed", parentId: null };
const otherSelf: LearnerRef = { id: "s2", type: "self_managed", parentId: null };

const learnerActions: Action[] = ["practise", "manageTracks", "addPackage", "addTopics", "viewProgress", "manageChildren"];

describe("can: on a learner (§2.3)", () => {
  //                         practise manageTracks addPackage addTopics viewProgress manageChildren
  const table: [string, Actor, LearnerRef, boolean[]][] = [
    ["self-managed, own", selfActor, self, [true, true, true, true, true, false]],
    ["self-managed, someone else", selfActor, otherSelf, [false, false, false, false, false, false]],
    ["parent-managed, own", childActor, child, [true, false, false, false, true, false]],
    ["parent-managed, sibling", childActor, sibling, [false, false, false, false, false, false]],
    ["parent, own child", parent, child, [false, true, true, true, true, true]],
    ["parent, another family's child", otherParent, child, [false, false, false, false, false, false]],
    ["parent, a self-managed learner", parent, self, [false, false, false, false, false, false]],
  ];
  for (const [name, actor, target, expected] of table) {
    it(name, () => {
      expect(learnerActions.map((a) => can(actor, a, target))).toEqual(expected);
    });
  }

  it("a parent can't act on a learner with their id who is no longer parent-managed", () => {
    expect(can(parent, "manageTracks", { id: "c1", type: "self_managed", parentId: "p1" })).toBe(false);
  });
});

describe("can: on the actor's own account (§2.3)", () => {
  const accountActions: Action[] = ["changeOwnPassword", "manageChildren", "deleteAccount"];
  const table: [string, Actor, boolean[]][] = [
    ["self-managed", selfActor, [true, false, true]],
    ["parent-managed", childActor, [false, false, false]],
    ["parent", parent, [true, true, true]],
  ];
  for (const [name, actor, expected] of table) {
    it(name, () => {
      expect(accountActions.map((a) => can(actor, a))).toEqual(expected);
    });
  }

  it("learner actions always need a target", () => {
    for (const a of ["practise", "manageTracks", "addPackage", "addTopics", "viewProgress"] as Action[]) {
      expect(can(selfActor, a)).toBe(false);
      expect(can(parent, a)).toBe(false);
    }
  });
});

describe("can: consent (editions §2.4, M10)", () => {
  it("an under-18 learner whose consent blocks practice can't practise, but can still manage their tracks", () => {
    const blocked: Actor = { ...selfActor, practiseBlocked: true } as Actor;
    expect(can(blocked, "practise", self)).toBe(false);
    expect(can(blocked, "manageTracks", self)).toBe(true);
    expect(can(blocked, "viewProgress", self)).toBe(true);
  });
});
