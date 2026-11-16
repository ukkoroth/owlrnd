import "server-only";
import { and, count, eq, gt, isNotNull, isNull, ne, sql } from "drizzle-orm";
import type { Identifier } from "@/domain/identity";
import { rules } from "@/config/rules";
import { db } from "../db";
import { discardFiles, fileKeysForParent, fileKeysForStudent } from "../jobs/files";
import { can, type Actor } from "@/domain/permissions";
import { parents, signInFailures, students } from "../db/schema";

export type Parent = typeof parents.$inferSelect;
export type Student = typeof students.$inferSelect;
/** A student is parent-managed (with their parent) or self-managed (parent null). */
export type Account = { kind: "parent"; parent: Parent } | { kind: "student"; student: Student; parent: Parent | null };

/**
 * Look up "username or email" (screens 3a, 5g). An email belongs to at most one account (owner, 2026-11-16): a
 * parent, or a self-managed learner. Usernames belong to parent-managed learners.
 */
export async function findAccount(id: Identifier): Promise<Account | null> {
  if (id.kind === "email") {
    const parent = await findParentByEmail(id.value);
    if (parent) return { kind: "parent", parent };
    const learner = await findSelfManagedByEmail(id.value);
    return learner ? { kind: "student", student: learner, parent: null } : null;
  }
  const [row] = await db
    .select({ student: students, parent: parents })
    .from(students)
    .innerJoin(parents, eq(parents.id, students.parentId))
    .where(and(eq(sql`lower(${students.username})`, id.value.toLowerCase()), eq(students.type, "parent_managed")));
  return row ? { kind: "student", ...row } : null;
}

export async function findSelfManagedByEmail(email: string) {
  const [learner] = await db
    .select()
    .from(students)
    .where(and(eq(sql`lower(${students.email})`, email.toLowerCase()), eq(students.type, "self_managed")));
  return learner ?? null;
}

/** The pending-step owner (pending.ts, codes.ts) for an account found at sign-in or forgot password. */
export function codeOwnerOf(account: Account): { parentId: string | null; studentId: string | null } {
  return account.kind === "parent"
    ? { parentId: account.parent.id, studentId: null }
    : { parentId: account.student.parentId, studentId: account.student.id };
}

export async function findParentByEmail(email: string) {
  const [parent] = await db.select().from(parents).where(eq(sql`lower(${parents.email})`, email.toLowerCase()));
  return parent ?? null;
}

export async function getParent(id: string) {
  const [parent] = await db.select().from(parents).where(eq(parents.id, id));
  return parent ?? null;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const sameEmail = (column: typeof students.email | typeof parents.email, email: string) => eq(sql`lower(${column})`, email.toLowerCase());

/** True if a *verified* self-managed learner other than `exceptId` signs in with this email (one email, one account). */
async function emailTakenByLearner(email: string, tx: Pick<typeof db, "select"> = db, exceptId?: string) {
  const [row] = await tx
    .select({ id: students.id })
    .from(students)
    .where(and(sameEmail(students.email, email), isNotNull(students.emailVerifiedAt), exceptId ? ne(students.id, exceptId) : undefined));
  return !!row;
}

/** Until verified, an account belongs to whoever reads the inbox: an abandoned learner sign-up gives way. */
async function dropUnverifiedLearner(email: string, tx: Tx, exceptId?: string) {
  await tx
    .delete(students)
    .where(and(sameEmail(students.email, email), eq(students.type, "self_managed"), isNull(students.emailVerifiedAt), exceptId ? ne(students.id, exceptId) : undefined));
}

/** The same for an abandoned parent sign-up (their unverified account has no children yet). */
async function dropUnverifiedParent(email: string, tx: Tx, exceptId?: string) {
  await tx.delete(parents).where(and(sameEmail(parents.email, email), isNull(parents.emailVerifiedAt), exceptId ? ne(parents.id, exceptId) : undefined));
}

/** True if a *verified* parent other than `exceptId`, or any self-managed learner, already uses this email. */
export async function emailTakenByVerified(email: string, exceptId?: string) {
  if (await emailTakenByLearner(email)) return true;
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
  input: { name: string; email: string; passwordHash: string; timeZone: string; consentedAt?: Date; consentVersion?: string },
  pendingParentId: string | null,
): Promise<{ ok: true; parentId: string } | { ok: false; reason: "email_taken" }> {
  return db.transaction(async (tx) => {
    if (await emailTakenByLearner(input.email, tx)) return { ok: false, reason: "email_taken" } as const;
    const [sameEmail] = await tx.select().from(parents).where(eq(sql`lower(${parents.email})`, input.email.toLowerCase()));
    if (sameEmail?.emailVerifiedAt) return { ok: false, reason: "email_taken" } as const;
    await dropUnverifiedLearner(input.email, tx);

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

export type LearnerSignUp = {
  name: string;
  email: string;
  passwordHash: string;
  timeZone: string;
  dateOfBirth: string;
  consentedAt: Date;
  consentVersion: string;
};

/**
 * Sign-up "For me" (sm-1b), like `upsertUnverifiedParent`: reuses the caller's own unverified learner (from "Use a
 * different email"), refuses an email a verified parent or learner uses, and replaces an unverified sign-up of
 * either kind with the same email.
 */
export async function upsertUnverifiedLearner(
  input: LearnerSignUp,
  pendingStudentId: string | null,
): Promise<{ ok: true; studentId: string } | { ok: false; reason: "email_taken" }> {
  return db.transaction(async (tx) => {
    let mine: Student | undefined;
    if (pendingStudentId) {
      [mine] = await tx.select().from(students).where(and(eq(students.id, pendingStudentId), eq(students.type, "self_managed"), isNull(students.emailVerifiedAt)));
    }
    if (await emailTakenByLearner(input.email, tx, mine?.id)) return { ok: false, reason: "email_taken" } as const;
    const [parent] = await tx.select({ verified: parents.emailVerifiedAt }).from(parents).where(sameEmail(parents.email, input.email));
    if (parent?.verified) return { ok: false, reason: "email_taken" } as const;
    await dropUnverifiedParent(input.email, tx);
    await dropUnverifiedLearner(input.email, tx, mine?.id);

    if (mine) {
      await tx.update(students).set(input).where(eq(students.id, mine.id));
      return { ok: true, studentId: mine.id } as const;
    }
    const [created] = await tx
      .insert(students)
      .values({ ...input, type: "self_managed", parentId: null, username: null })
      .returning({ id: students.id });
    return { ok: true, studentId: created!.id } as const;
  });
}

export async function markLearnerEmailVerified(studentId: string, now = new Date()) {
  await db.update(students).set({ emailVerifiedAt: now }).where(and(eq(students.id, studentId), eq(students.type, "self_managed")));
}

export async function getLearner(id: string) {
  const [learner] = await db.select().from(students).where(eq(students.id, id));
  return learner ?? null;
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
/** Deletes the parent and, by cascade, every child, track, exam and attachment row; their files are queued for deletion. */
export async function deleteParent(parentId: string) {
  await db.transaction(async (tx) => {
    const keys = await fileKeysForParent(tx, parentId);
    await tx.delete(parents).where(eq(parents.id, parentId));
    await discardFiles(keys, tx);
  });
}

/**
 * Finish an email change (5d): the new address is confirmed by the code. Fails if a verified parent took the
 * address meanwhile; an abandoned unverified sign-up with that address is removed.
 */
export async function changeParentEmail(parentId: string, newEmail: string) {
  return db.transaction(async (tx) => {
    if (await emailTakenByLearner(newEmail, tx)) return false;
    await dropUnverifiedLearner(newEmail, tx);
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

/** Finish a self-managed learner's email change, like `changeParentEmail` (one email, one account). */
export async function changeLearnerEmail(studentId: string, newEmail: string) {
  return db.transaction(async (tx) => {
    if (await emailTakenByLearner(newEmail, tx, studentId)) return false;
    const [parent] = await tx.select({ verified: parents.emailVerifiedAt }).from(parents).where(sameEmail(parents.email, newEmail));
    if (parent?.verified) return false;
    await dropUnverifiedParent(newEmail, tx);
    await dropUnverifiedLearner(newEmail, tx, studentId);
    await tx.update(students).set({ email: newEmail, emailVerifiedAt: new Date() }).where(and(eq(students.id, studentId), eq(students.type, "self_managed")));
    return true;
  });
}

// ── The account holder's own account (5d for parents, sm-5b for self-managed learners) ──

/**
 * The account the signed-in actor holds, if they hold one: a parent, or a self-managed learner. A parent-managed
 * learner holds none (their parent does), so they can't change their password or delete their account (§2.3).
 */
export type OwnAccount =
  | { kind: "parent"; id: string; name: string; email: string; passwordHash: string; codeOwner: { parentId: string; studentId: null } }
  | { kind: "learner"; id: string; name: string; email: string; passwordHash: string; codeOwner: { parentId: null; studentId: string } };

export async function ownAccount(actor: Actor): Promise<OwnAccount | null> {
  if (!can(actor, "changeOwnPassword")) return null;
  if (actor.kind === "parent") {
    const p = await getParent(actor.parentId);
    return p ? { kind: "parent", id: p.id, name: p.name, email: p.email, passwordHash: p.passwordHash, codeOwner: { parentId: p.id, studentId: null } } : null;
  }
  const s = await getLearner(actor.studentId);
  if (!s || s.type !== "self_managed" || !s.email) return null;
  return { kind: "learner", id: s.id, name: s.name, email: s.email, passwordHash: s.passwordHash, codeOwner: { parentId: null, studentId: s.id } };
}

export async function renameAccount(account: OwnAccount, name: string) {
  if (account.kind === "parent") await db.update(parents).set({ name }).where(eq(parents.id, account.id));
  else await db.update(students).set({ name }).where(eq(students.id, account.id));
}

/** True if another verified account (or any self-managed learner but this one) already uses the email. */
export async function emailInUseByOther(account: OwnAccount, email: string) {
  if (await emailTakenByLearner(email, db, account.kind === "learner" ? account.id : undefined)) return true;
  const [p] = await db
    .select({ id: parents.id })
    .from(parents)
    .where(and(sameEmail(parents.email, email), isNotNull(parents.emailVerifiedAt), account.kind === "parent" ? ne(parents.id, account.id) : undefined));
  return !!p;
}

export const changeAccountEmail = (account: OwnAccount, newEmail: string) =>
  account.kind === "parent" ? changeParentEmail(account.id, newEmail) : changeLearnerEmail(account.id, newEmail);

export async function setAccountPassword(account: OwnAccount, passwordHash: string) {
  if (account.kind === "parent") await db.update(parents).set({ passwordHash }).where(eq(parents.id, account.id));
  else await db.update(students).set({ passwordHash }).where(eq(students.id, account.id));
}

/**
 * Delete the account and its data (§2.3). A parent's goes with every child; a self-managed learner's with their
 * tracks, exams and points. Codes and sessions cascade; files are queued for deletion.
 */
export async function deleteOwnAccount(actor: Actor, account: OwnAccount) {
  if (!can(actor, "deleteAccount")) return false;
  if (account.kind === "parent") {
    await deleteParent(account.id);
    return true;
  }
  await deleteSelfManagedLearner(account.id);
  return true;
}

/**
 * Deletes a self-managed learner and their data: tracks, exams, points, codes and sessions by cascade, and their
 * files queued for deletion. Used by "Delete my account" and when a parent declines consent (M10).
 */
export async function deleteSelfManagedLearner(studentId: string) {
  await db.transaction(async (tx) => {
    const keys = await fileKeysForStudent(tx, studentId);
    await tx.delete(students).where(and(eq(students.id, studentId), eq(students.type, "self_managed")));
    await discardFiles(keys, tx);
  });
}
