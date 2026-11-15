import "server-only";
import { and, count, eq, gt, isNotNull, ne, sql } from "drizzle-orm";
import type { Identifier } from "@/domain/identity";
import { rules } from "@/config/rules";
import { db } from "../db";
import { parents, signInFailures, students } from "../db/schema";

export type Parent = typeof parents.$inferSelect;
export type Student = typeof students.$inferSelect;
export type Account = { kind: "parent"; parent: Parent } | { kind: "student"; student: Student; parent: Parent };

/** Look up "username or email" (screens 3a, 5g). */
export async function findAccount(id: Identifier): Promise<Account | null> {
  if (id.kind === "email") {
    const parent = await findParentByEmail(id.value);
    return parent ? { kind: "parent", parent } : null;
  }
  const [row] = await db
    .select({ student: students, parent: parents })
    .from(students)
    .innerJoin(parents, eq(parents.id, students.parentId))
    .where(eq(sql`lower(${students.username})`, id.value.toLowerCase()));
  return row ? { kind: "student", ...row } : null;
}

export async function findParentByEmail(email: string) {
  const [parent] = await db.select().from(parents).where(eq(sql`lower(${parents.email})`, email.toLowerCase()));
  return parent ?? null;
}

export async function getParent(id: string) {
  const [parent] = await db.select().from(parents).where(eq(parents.id, id));
  return parent ?? null;
}

/** True if a *verified* parent other than `exceptId` already uses this email. */
export async function emailTakenByVerified(email: string, exceptId?: string) {
  const [row] = await db
    .select({ id: parents.id })
    .from(parents)
    .where(
      and(
        eq(sql`lower(${parents.email})`, email.toLowerCase()),
        isNotNull(parents.emailVerifiedAt),
        exceptId ? ne(parents.id, exceptId) : undefined,
      ),
    );
  return !!row;
}

/**
 * Sign-up (1a). Reuses the caller's own unverified account (from "Use a different email"), and replaces any other
 * unverified sign-up for the same email: until verified, an account belongs to whoever can read the inbox.
 */
export async function upsertUnverifiedParent(
  input: { name: string; email: string; passwordHash: string; timeZone: string },
  pendingParentId: string | null,
): Promise<{ ok: true; parentId: string } | { ok: false; reason: "email_taken" }> {
  return db.transaction(async (tx) => {
    const [sameEmail] = await tx.select().from(parents).where(eq(sql`lower(${parents.email})`, input.email.toLowerCase()));
    if (sameEmail?.emailVerifiedAt) return { ok: false, reason: "email_taken" } as const;

    let mine: Parent | undefined;
    if (pendingParentId) {
      [mine] = await tx.select().from(parents).where(eq(parents.id, pendingParentId));
      if (mine?.emailVerifiedAt) mine = undefined;
    }
    if (sameEmail && sameEmail.id !== mine?.id) await tx.delete(parents).where(eq(parents.id, sameEmail.id));

    if (mine) {
      await tx.update(parents).set(input).where(eq(parents.id, mine.id));
      return { ok: true, parentId: mine.id } as const;
    }
    const [created] = await tx.insert(parents).values(input).returning({ id: parents.id });
    return { ok: true, parentId: created!.id } as const;
  });
}

export async function markEmailVerified(parentId: string, now = new Date()) {
  await db.update(parents).set({ emailVerifiedAt: now }).where(eq(parents.id, parentId));
}

export async function recordSignInFailure(identifier: string, ip: string | null) {
  await db.insert(signInFailures).values({ identifier: identifier.toLowerCase(), ip });
}

export async function tooManySignInFailures(identifier: string, now = new Date()) {
  const { max, windowMinutes } = rules.accounts.signInFailures;
  const since = new Date(now.getTime() - windowMinutes * 60_000);
  const [{ n } = { n: 0 }] = await db
    .select({ n: count() })
    .from(signInFailures)
    .where(and(eq(signInFailures.identifier, identifier.toLowerCase()), gt(signInFailures.createdAt, since)));
  return n >= max;
}

/** 5d "Delete my account": students, their codes and sessions go with it (FK cascades). */
export async function deleteParent(parentId: string) {
  await db.delete(parents).where(eq(parents.id, parentId));
}

/**
 * Finish an email change (5d): the new address is confirmed by the code. Fails if a verified parent took the
 * address meanwhile; an abandoned unverified sign-up with that address is removed.
 */
export async function changeParentEmail(parentId: string, newEmail: string) {
  return db.transaction(async (tx) => {
    const [other] = await tx
      .select()
      .from(parents)
      .where(and(eq(sql`lower(${parents.email})`, newEmail.toLowerCase()), ne(parents.id, parentId)));
    if (other?.emailVerifiedAt) return false;
    if (other) await tx.delete(parents).where(eq(parents.id, other.id));
    await tx.update(parents).set({ email: newEmail, emailVerifiedAt: new Date() }).where(eq(parents.id, parentId));
    return true;
  });
}
