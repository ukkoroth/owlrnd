import type { LearnerType } from "./permissions";

/**
 * The account holder: whoever controls an account (editions §2.3). Their email receives the sign-in codes,
 * their AI allowance is spent, and their time zone counts the daily limits.
 */
export type Holder =
  | { kind: "parent"; parentId: string; name: string; email: string; timeZone: string; aiLimitUsd: number | null }
  | { kind: "learner"; studentId: string; name: string; email: string; timeZone: string; aiLimitUsd: number | null };

/** The usage key of a holder: the family (parent) or the self-managed learner. */
export type HolderRef = { parentId: string } | { studentId: string };

type ParentRow = { id: string; name: string; email: string; timeZone: string; aiLimitUsd: number | null };
type LearnerRow = {
  id: string;
  type: LearnerType;
  name: string;
  email: string | null;
  timeZone: string;
  aiLimitUsd: number | null;
};

export const holderForParent = (p: ParentRow): Holder => ({
  kind: "parent",
  parentId: p.id,
  name: p.name,
  email: p.email,
  timeZone: p.timeZone,
  aiLimitUsd: p.aiLimitUsd,
});

/** Parent-managed → their parent; self-managed → the learner themselves. */
export function controllerOf(learner: LearnerRow, parent: ParentRow | null): Holder {
  if (learner.type === "parent_managed") {
    if (!parent) throw new Error("controllerOf: a parent-managed learner needs their parent");
    return holderForParent(parent);
  }
  if (!learner.email) throw new Error("controllerOf: a self-managed learner needs an email");
  return {
    kind: "learner",
    studentId: learner.id,
    name: learner.name,
    email: learner.email,
    timeZone: learner.timeZone,
    aiLimitUsd: learner.aiLimitUsd,
  };
}

export const holderRef = (h: Holder): HolderRef => (h.kind === "parent" ? { parentId: h.parentId } : { studentId: h.studentId });
