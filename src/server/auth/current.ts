import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { rules } from "@/config/rules";
import { readPending, signPending, type Pending, type PendingKind } from "./pending";
import { createSession, revokeSession, validateSession, type CurrentUser, type SessionOwner } from "./sessions";

export const SESSION_COOKIE = "owlrnd_session";
const PENDING_COOKIE = "owlrnd_pending";
const secure = process.env.NODE_ENV === "production";

/** The signed-in user for this request (cached per request). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? validateSession(token) : null;
});

export async function requireParent() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "parent") redirect("/today");
  return user;
}

export async function requireStudent() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "student") redirect("/students");
  return user;
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
    maxAge: rules.accounts.sessionIdleDays * 24 * 60 * 60,
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

export async function clientIp() {
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}
