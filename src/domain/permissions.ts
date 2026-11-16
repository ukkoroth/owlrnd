/**
 * The one permission policy (docs/11-editions.md §2.3). Every screen and server call asks `can`; screens hide what it
 * refuses and the server refuses it anyway. Don't add role checks anywhere else.
 */

export type LearnerType = "self_managed" | "parent_managed";

/** Who is signed in. */
export type Actor =
  | { kind: "parent"; parentId: string }
  | { kind: "learner"; studentId: string; type: LearnerType; parentId: string | null };

/** The learner an action is about. */
export type LearnerRef = { id: string; type: LearnerType; parentId: string | null };

export type Action =
  /** Take exams, see own results and points. */
  | "practise"
  /** Create, edit, pause, archive tracks (and retry a failed exam write). */
  | "manageTracks"
  | "addPackage"
  /** Add topics after a goal is reached. */
  | "addTopics"
  | "changeOwnPassword"
  /** See activity, progress, history and marked papers. */
  | "viewProgress"
  /** Add, edit or remove children; set a child's password. */
  | "manageChildren"
  | "deleteAccount";

/** Actions on the actor's own account rather than on a learner. */
const ACCOUNT_ACTIONS = new Set<Action>(["changeOwnPassword", "manageChildren", "deleteAccount"]);

/** What each kind of account may do to a learner it is allowed to see. */
const ON_LEARNER: Record<"parent" | LearnerType, ReadonlySet<Action>> = {
  parent: new Set(["manageTracks", "addPackage", "addTopics", "viewProgress", "manageChildren"]),
  self_managed: new Set(["practise", "manageTracks", "addPackage", "addTopics", "viewProgress"]),
  parent_managed: new Set(["practise", "viewProgress"]),
};

/** What each kind of account may do to its own account. */
const ON_ACCOUNT: Record<"parent" | LearnerType, ReadonlySet<Action>> = {
  parent: new Set(["changeOwnPassword", "manageChildren", "deleteAccount"]),
  self_managed: new Set(["changeOwnPassword", "deleteAccount"]),
  parent_managed: new Set(),
};

const kindOf = (actor: Actor) => (actor.kind === "parent" ? "parent" : actor.type);

/** Whether the learner is the actor's own: themselves, or (for a parent) a child they manage. */
export function isOwnLearner(actor: Actor, learner: LearnerRef): boolean {
  if (actor.kind === "learner") return learner.id === actor.studentId;
  return learner.type === "parent_managed" && learner.parentId === actor.parentId;
}

/**
 * `target` is the learner the action is about. Leave it out for actions on the actor's own account
 * (changeOwnPassword, manageChildren as "add a child", deleteAccount).
 */
export function can(actor: Actor, action: Action, target?: LearnerRef): boolean {
  const kind = kindOf(actor);
  if (!target) return ACCOUNT_ACTIONS.has(action) && ON_ACCOUNT[kind].has(action);
  return isOwnLearner(actor, target) && ON_LEARNER[kind].has(action);
}

/** The learner an actor practises as, if any (the student shell). */
export const practisingLearnerId = (actor: Actor) => (actor.kind === "learner" ? actor.studentId : null);
