import "server-only";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { can, type Actor } from "@/domain/permissions";
import { hashPassword } from "./auth/passwords";
import { revokeAllSessions } from "./auth/sessions";
import { db } from "./db";
import { discardFiles, fileKeysForStudent } from "./jobs/files";
import { parentLinks, parents, students } from "./db/schema";
import { authorizeLearner } from "./learners";

// A parent's children (5e, 2k). Every function checks the permission policy for the signed-in actor; the actor
// always comes from the session, never from a form.

export type Student = typeof students.$inferSelect;

/** The children a parent manages; empty for anyone else. */
export async function listStudents(actor: Actor): Promise<Student[]> {
  if (actor.kind !== "parent" || !can(actor, "manageChildren")) return [];
  return db.select().from(students).where(and(eq(students.parentId, actor.parentId), eq(students.type, "parent_managed"))).orderBy(asc(students.createdAt));
}

/** The child, if `actor` may see their progress (their parent); otherwise null ("not found", never "forbidden"). */
export async function getOwnStudent(actor: Actor, studentId: string): Promise<Student | null> {
  return (await authorizeLearner(actor, "viewProgress", studentId))?.student ?? null;
}

/** The child, if `actor` may manage them (add, edit, remove, set password). */
async function manageable(actor: Actor, studentId: string) {
  return (await authorizeLearner(actor, "manageChildren", studentId))?.student ?? null;
}

/** Usernames are unique across the whole app, ignoring case (rules §1). */
export async function usernameTaken(username: string, exceptStudentId?: string) {
  const [row] = await db
    .select({ id: students.id })
    .from(students)
    .where(and(eq(sql`lower(${students.username})`, username.toLowerCase()), exceptStudentId ? ne(students.id, exceptStudentId) : undefined));
  return !!row;
}

const isUniqueViolation = (err: unknown) =>
  typeof err === "object" && err !== null && (err as { code?: string; cause?: { code?: string } }).code === "23505"
    ? true
    : (err as { cause?: { code?: string } })?.cause?.code === "23505";

export type StudentDetails = { name: string; className: string; username: string };

export async function createStudent(
  actor: Actor,
  input: StudentDetails & { password: string },
): Promise<{ ok: true; student: Student } | { ok: false; reason: "username_taken" | "not_allowed" }> {
  if (actor.kind !== "parent" || !can(actor, "manageChildren")) return { ok: false, reason: "not_allowed" };
  const parentId = actor.parentId;
  if (await usernameTaken(input.username)) return { ok: false, reason: "username_taken" };
  const [parent] = await db.select({ timeZone: parents.timeZone }).from(parents).where(eq(parents.id, parentId));
  try {
    const [student] = await db
      .insert(students)
      .values({
        type: "parent_managed",
        parentId,
        name: input.name,
        className: input.className,
        username: input.username,
        passwordHash: await hashPassword(input.password),
        // "Today" for the student uses the time zone of the parent's device (docs/10-decisions.md).
        timeZone: parent?.timeZone ?? "UTC",
      })
      .returning();
    await db.insert(parentLinks).values({ parentId, studentId: student!.id, kind: "manages", status: "active", givenAt: new Date() });
    return { ok: true, student: student! };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, reason: "username_taken" };
    throw err;
  }
}

export async function updateStudentDetails(
  actor: Actor,
  studentId: string,
  input: StudentDetails,
): Promise<{ ok: true } | { ok: false; reason: "not_found" | "username_taken" }> {
  if (!(await manageable(actor, studentId))) return { ok: false, reason: "not_found" };
  if (await usernameTaken(input.username, studentId)) return { ok: false, reason: "username_taken" };
  try {
    await db.update(students).set(input).where(eq(students.id, studentId));
    return { ok: true };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, reason: "username_taken" };
    throw err;
  }
}

/** Owner decision (M2): a new password set by the parent signs the student out everywhere straight away. */
export async function setStudentPassword(actor: Actor, studentId: string, password: string) {
  if (!(await manageable(actor, studentId))) return false;
  await db
    .update(students)
    .set({ passwordHash: await hashPassword(password) })
    .where(eq(students.id, studentId));
  await revokeAllSessions({ studentId });
  return true;
}

/** 5e: removes the student's account; codes, sessions (and later tracks, exams, points) go by FK cascade. */
/** Removes a child and, by cascade, their tracks, exams and attachment rows; their files are queued for deletion. */
export async function removeStudent(actor: Actor, studentId: string) {
  if (!(await manageable(actor, studentId))) return false;
  return db.transaction(async (tx) => {
    const keys = await fileKeysForStudent(tx, studentId);
    const removed = await tx.delete(students).where(eq(students.id, studentId)).returning({ id: students.id });
    if (!removed.length) return false;
    await discardFiles(keys, tx);
    return true;
  });
}
