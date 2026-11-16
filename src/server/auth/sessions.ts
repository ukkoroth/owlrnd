import "server-only";
import { and, eq, gt, ne } from "drizzle-orm";
import { rules } from "@/config/rules";
import type { LearnerType } from "@/domain/permissions";
import { db } from "../db";
import { parents, sessions, students } from "../db/schema";
import { randomToken, sha256 } from "./crypto";

const HOUR_MS = 60 * 60_000;

/** How long a session lasts without use, by account type (rules.accounts.sessionIdleHours). */
export function idleMs(type: "parent" | LearnerType): number {
  return rules.accounts.sessionIdleHours[type] * HOUR_MS;
}

/** last_seen_at is refreshed at most this often: hourly, or sooner for short sessions. */
const touchEveryMs = (type: "parent" | LearnerType) => Math.min(HOUR_MS, idleMs(type) / 4);

export type SessionOwner = { parentId: string } | { studentId: string };

async function ownerType(owner: SessionOwner): Promise<"parent" | LearnerType> {
  if ("parentId" in owner) return "parent";
  const [row] = await db.select({ type: students.type }).from(students).where(eq(students.id, owner.studentId));
  if (!row) throw new Error("createSession: student not found");
  return row.type;
}

export async function createSession(owner: SessionOwner, userAgent: string | null, now = new Date()): Promise<string> {
  const token = randomToken();
  const type = await ownerType(owner);
  await db.insert(sessions).values({
    tokenHash: sha256(token),
    parentId: "parentId" in owner ? owner.parentId : null,
    studentId: "studentId" in owner ? owner.studentId : null,
    userAgent: userAgent?.slice(0, 300) ?? null,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + idleMs(type)),
  });
  return token;
}

export type Parent = typeof parents.$inferSelect;
export type Student = typeof students.$inferSelect;

/** A signed-in student: parent-managed learners carry their parent; self-managed learners have none. */
export type CurrentUser =
  | { role: "parent"; sessionId: string; parent: Parent }
  | { role: "student"; sessionId: string; student: Student; parent: Parent | null };

/**
 * The signed-in user for a session token, sliding the idle expiry for their account type. Null if unknown or
 * expired. The idle window is checked against last use as well as the stored expiry, so shortening it in the rules
 * applies to sessions already open.
 */
export async function validateSession(token: string, now = new Date()): Promise<CurrentUser | null> {
  const [row] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, now)));
  if (!row) return null;

  let user: CurrentUser | null;
  if (row.parentId) {
    const [parent] = await db.select().from(parents).where(eq(parents.id, row.parentId));
    user = parent ? { role: "parent", sessionId: row.id, parent } : null;
  } else {
    const [found] = await db
      .select({ student: students, parent: parents })
      .from(students)
      .leftJoin(parents, eq(parents.id, students.parentId))
      .where(eq(students.id, row.studentId!));
    user = found ? { role: "student", sessionId: row.id, ...found } : null;
  }
  if (!user) return null;

  const type = user.role === "parent" ? "parent" : user.student.type;
  if (now.getTime() - row.lastSeenAt.getTime() > idleMs(type)) {
    await db.delete(sessions).where(eq(sessions.id, row.id));
    return null;
  }
  if (now.getTime() - row.lastSeenAt.getTime() > touchEveryMs(type)) {
    await db
      .update(sessions)
      .set({ lastSeenAt: now, expiresAt: new Date(now.getTime() + idleMs(type)) })
      .where(eq(sessions.id, row.id));
  }
  return user;
}

export async function revokeSession(token: string) {
  await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
}

/** After a password change or reset: sign out every device, optionally keeping the current one. */
export async function revokeAllSessions(owner: SessionOwner, exceptSessionId?: string) {
  const ownerCond = "parentId" in owner ? eq(sessions.parentId, owner.parentId) : eq(sessions.studentId, owner.studentId);
  await db.delete(sessions).where(exceptSessionId ? and(ownerCond, ne(sessions.id, exceptSessionId)) : ownerCond);
}
