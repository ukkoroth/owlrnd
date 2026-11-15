import "server-only";
import { and, eq, gt, ne } from "drizzle-orm";
import { rules } from "@/config/rules";
import { db } from "../db";
import { parents, sessions, students } from "../db/schema";
import { randomToken, sha256 } from "./crypto";

const IDLE_MS = rules.accounts.sessionIdleDays * 24 * 60 * 60_000;
const TOUCH_EVERY_MS = 60 * 60_000; // refresh last_seen_at at most hourly

export type SessionOwner = { parentId: string } | { studentId: string };

export async function createSession(owner: SessionOwner, userAgent: string | null, now = new Date()): Promise<string> {
  const token = randomToken();
  await db.insert(sessions).values({
    tokenHash: sha256(token),
    parentId: "parentId" in owner ? owner.parentId : null,
    studentId: "studentId" in owner ? owner.studentId : null,
    userAgent: userAgent?.slice(0, 300) ?? null,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + IDLE_MS),
  });
  return token;
}

export type CurrentUser =
  | { role: "parent"; sessionId: string; parent: typeof parents.$inferSelect }
  | { role: "student"; sessionId: string; student: typeof students.$inferSelect; parent: typeof parents.$inferSelect };

/** The signed-in user for a session token, sliding the 30-day idle expiry. Null if unknown or expired. */
export async function validateSession(token: string, now = new Date()): Promise<CurrentUser | null> {
  const [row] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, now)));
  if (!row) return null;

  if (now.getTime() - row.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
    await db
      .update(sessions)
      .set({ lastSeenAt: now, expiresAt: new Date(now.getTime() + IDLE_MS) })
      .where(eq(sessions.id, row.id));
  }

  if (row.parentId) {
    const [parent] = await db.select().from(parents).where(eq(parents.id, row.parentId));
    return parent ? { role: "parent", sessionId: row.id, parent } : null;
  }
  const [found] = await db
    .select({ student: students, parent: parents })
    .from(students)
    .innerJoin(parents, eq(parents.id, students.parentId))
    .where(eq(students.id, row.studentId!));
  return found ? { role: "student", sessionId: row.id, ...found } : null;
}

export async function revokeSession(token: string) {
  await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
}

/** After a password change or reset: sign out every device, optionally keeping the current one. */
export async function revokeAllSessions(owner: SessionOwner, exceptSessionId?: string) {
  const ownerCond = "parentId" in owner ? eq(sessions.parentId, owner.parentId) : eq(sessions.studentId, owner.studentId);
  await db.delete(sessions).where(exceptSessionId ? and(ownerCond, ne(sessions.id, exceptSessionId)) : ownerCond);
}
