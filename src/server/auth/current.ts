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
