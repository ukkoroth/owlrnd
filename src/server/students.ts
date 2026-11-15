import "server-only";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { hashPassword } from "./auth/passwords";
import { revokeAllSessions } from "./auth/sessions";
import { db } from "./db";
import { parents, students } from "./db/schema";

// Every function is scoped to the parent: the parent id always comes from the session, never from a form.

export type Student = typeof students.$inferSelect;

export function listStudents(parentId: string) {
  return db.select().from(students).where(eq(students.parentId, parentId)).orderBy(asc(students.createdAt));
}

/** The student if it belongs to this parent, otherwise null (callers show "not found", never "forbidden"). */
export async function getOwnStudent(parentId: string, studentId: string): Promise<Student | null> {
  if (!/^[0-9a-f-]{36}$/i.test(studentId)) return null;
  const [row] = await db
    .select()
    .from(students)
    .where(and(eq(students.id, studentId), eq(students.parentId, parentId)));
  return row ?? null;
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
  parentId: string,
  input: StudentDetails & { password: string },
): Promise<{ ok: true; student: Student } | { ok: false; reason: "username_taken" }> {
  if (await usernameTaken(input.username)) return { ok: false, reason: "username_taken" };
  const [parent] = await db.select({ timeZone: parents.timeZone }).from(parents).where(eq(parents.id, parentId));
  try {
    const [student] = await db
      .insert(students)
      .values({
        parentId,
        name: input.name,
        className: input.className,
        username: input.username,
        passwordHash: await hashPassword(input.password),
        // "Today" for the student uses the time zone of the parent's device (docs/10-decisions.md).
        timeZone: parent?.timeZone ?? "UTC",
      })
      .returning();
    return { ok: true, student: student! };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, reason: "username_taken" };
    throw err;
  }
}

export async function updateStudentDetails(
  parentId: string,
  studentId: string,
  input: StudentDetails,
): Promise<{ ok: true } | { ok: false; reason: "not_found" | "username_taken" }> {
  if (!(await getOwnStudent(parentId, studentId))) return { ok: false, reason: "not_found" };
  if (await usernameTaken(input.username, studentId)) return { ok: false, reason: "username_taken" };
  try {
    await db
      .update(students)
      .set(input)
      .where(and(eq(students.id, studentId), eq(students.parentId, parentId)));
    return { ok: true };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, reason: "username_taken" };
    throw err;
  }
}

/** Owner decision (M2): a new password set by the parent signs the student out everywhere straight away. */
export async function setStudentPassword(parentId: string, studentId: string, password: string) {
  if (!(await getOwnStudent(parentId, studentId))) return false;
  await db
    .update(students)
    .set({ passwordHash: await hashPassword(password) })
    .where(and(eq(students.id, studentId), eq(students.parentId, parentId)));
  await revokeAllSessions({ studentId });
  return true;
}

/** 5e: removes the student's account; codes, sessions (and later tracks, exams, points) go by FK cascade. */
export async function removeStudent(parentId: string, studentId: string) {
  const removed = await db
    .delete(students)
    .where(and(eq(students.id, studentId), eq(students.parentId, parentId)))
    .returning({ id: students.id });
  return removed.length > 0;
}
