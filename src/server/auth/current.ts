import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { rules } from "@/config/rules";
import { readPending, signPending, type Pending, type PendingKind } from "./pending";
import { can, type Actor } from "@/domain/permissions";
import { learnerConsent, type LearnerConsent } from "../consent";
import { createSession, idleMs, revokeSession, validateSession, type CurrentUser, type SessionOwner } from "./sessions";

export const SESSION_COOKIE = "owlrnd_session";
const PENDING_COOKIE = "owlrnd_pending";
const secure = process.env.NODE_ENV === "production";

/** The signed-in user for this request (cached per request). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? validateSession(token) : null;
});

/** Consent for the signed-in learner (M10), once per request. Adults and children: not needed. */
export const getLearnerConsent = cache(async (): Promise<LearnerConsent | null> => {
  const user = await getCurrentUser();
  return user?.role === "student" ? learnerConsent(user.student) : null;
});

/** The permission-policy actor for a signed-in user (domain/permissions.ts). */
export function actorOf(user: CurrentUser, consent: LearnerConsent | null = null): Actor {
  return user.role === "parent"
    ? { kind: "parent", parentId: user.parent.id }
    : {
        kind: "learner",
        studentId: user.student.id,
        type: user.student.type,
        parentId: user.student.parentId,
        practiseBlocked: consent ? !consent.practiseAllowed : false,
      };
}

type ParentUser = Extract<CurrentUser, { role: "parent" }>;
type StudentUser = Extract<CurrentUser, { role: "student" }>;

/** Any signed-in user, or a redirect to sign-in. What they may do is decided by `can` (server/learners.ts). */
export async function requireActor(): Promise<{ user: CurrentUser; actor: Actor }> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return { user, actor: actorOf(user, await getLearnerConsent()) };
}

/**
 * Which set of screens to show: the parent's (Your students) or the learner's (Exams). This only picks the shell;
 * permissions are checked by the server functions through `can`.
 */
export async function requireShell(shell: "parent"): Promise<{ user: ParentUser; actor: Actor }>;
export async function requireShell(shell: "learner"): Promise<{ user: StudentUser; actor: Actor }>;
export async function requireShell(shell: "parent" | "learner") {
  const { user, actor } = await requireActor();
  const inShell = shell === "parent" ? user.role === "parent" : user.role === "student";
  if (!inShell) redirect(homeFor(user));
  return { user, actor };
}

/**
 * Taking an exam (the paper, its actions, marking and the marked paper). Refused while a parent's consent blocks
 * practice (M10); the dashboard's banner explains why.
 */
export async function requirePractice() {
  const { user, actor } = await requireShell("learner");
  if (!can(actor, "practise", user.student)) redirect("/today");
  return { user, actor };
}

/** Where each role lands after signing in (rules §1: parent → 2k, student → 3c). */
export function homeFor(user: { role: "parent" | "student" }) {
  return user.role === "parent" ? "/students" : "/today";
}

export async function startSession(owner: SessionOwner) {
  const userAgent = (await headers()).get("user-agent");
  const token = await createSession(owner, userAgent);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    // The longest idle window; the database ends shorter sessions (sessions.ts). Kept in step with middleware.ts.
    maxAge: idleMs("parent") / 1000,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await revokeSession(token);
  jar.delete(SESSION_COOKIE);
}

export async function setPending(p: Omit<Pending, "exp">) {
  (await cookies()).set(PENDING_COOKIE, signPending(p), {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: rules.accounts.pendingStepMinutes * 60,
  });
}

export async function getPending(kind: PendingKind) {
  return readPending((await cookies()).get(PENDING_COOKIE)?.value, kind);
}

export async function clearPending() {
  (await cookies()).delete(PENDING_COOKIE);
}

/**
 * The visitor's IP address. In production one proxy (Caddy) sits in front of the app and appends the address it
 * saw to X-Forwarded-For, so the last entry is the one to trust; earlier entries can be forged by the client.
 * Null when there is no proxy (local development and tests).
 */
export async function clientIp() {
  return lastForwardedIp((await headers()).get("x-forwarded-for"));
}

/**
 * Without a proxy, Next.js fills X-Forwarded-For with the connecting address, which is loopback when browsing or
 * testing on the same machine; a real visitor never arrives from loopback, so it counts as no address.
 */
export function lastForwardedIp(forwarded: string | null) {
  const ip = forwarded?.split(",").at(-1)?.trim() || null;
  return ip && !/^(127\.|::1$|::ffff:127\.)/.test(ip) ? ip : null;
}
