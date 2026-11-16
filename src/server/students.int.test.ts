import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { cleanup, makeParent, parentActor } from "../../tests/db-helpers";
import { issueCode } from "./auth/codes";
import { createSession, validateSession } from "./auth/sessions";
import { db } from "./db";
import { codes, sessions, students } from "./db/schema";
import { createStudent, getOwnStudent, listStudents, removeStudent, setStudentPassword, updateStudentDetails } from "./students";

afterAll(cleanup);

const uname = () => `kid.${randomUUID().slice(0, 8)}`;
const details = (username = uname()) => ({ name: "Scout", className: "Class 10", username, password: "practice1" });

describe("students", () => {
  it("creates a student with the parent's time zone", async () => {
    const parent = await makeParent({ timeZone: "Asia/Kolkata" });
    const res = await createStudent(parentActor(parent.id), details());
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.student.timeZone).toBe("Asia/Kolkata");
      expect(res.student.passwordHash).not.toBe("practice1");
    }
    expect(await listStudents(parentActor(parent.id))).toHaveLength(1);
  });

  it("refuses a username already used anywhere in the app, ignoring case", async () => {
    const a = await makeParent();
    const b = await makeParent();
    const username = uname();
    expect((await createStudent(parentActor(a.id), details(username))).ok).toBe(true);
    expect(await createStudent(parentActor(b.id), details(username.toUpperCase()))).toEqual({ ok: false, reason: "username_taken" });
  });

  it("keeps the same username when other details change, but refuses another student's", async () => {
    const parent = await makeParent();
    const first = await createStudent(parentActor(parent.id), details());
    const second = await createStudent(parentActor(parent.id), details());
    if (!first.ok || !second.ok) throw new Error("setup");
    expect(await updateStudentDetails(parentActor(parent.id), first.student.id, { name: "Scout F", className: "Class 11", username: first.student.username! })).toEqual({ ok: true });
    expect(await updateStudentDetails(parentActor(parent.id), first.student.id, { name: "Scout", className: "10", username: second.student.username! })).toEqual({
      ok: false,
      reason: "username_taken",
    });
  });

  it("never lets one parent see, change or remove another family's student", async () => {
    const owner = await makeParent();
    const other = await makeParent();
    const res = await createStudent(parentActor(owner.id), details());
    if (!res.ok) throw new Error("setup");
    const id = res.student.id;
    expect(await getOwnStudent(parentActor(other.id), id)).toBeNull();
    expect(await updateStudentDetails(parentActor(other.id), id, { name: "X", className: "1", username: uname() })).toEqual({ ok: false, reason: "not_found" });
    expect(await setStudentPassword(parentActor(other.id), id, "hijacked1")).toBe(false);
    expect(await removeStudent(parentActor(other.id), id)).toBe(false);
    expect(await getOwnStudent(parentActor(owner.id), id)).not.toBeNull();
    expect(await getOwnStudent(parentActor(owner.id), "not-a-uuid")).toBeNull();
  });

  it("a new password signs the student out everywhere", async () => {
    const parent = await makeParent();
    const res = await createStudent(parentActor(parent.id), details());
    if (!res.ok) throw new Error("setup");
    const token = await createSession({ studentId: res.student.id }, null);
    expect(await validateSession(token)).not.toBeNull();
    expect(await setStudentPassword(parentActor(parent.id), res.student.id, "practice2")).toBe(true);
    expect(await validateSession(token)).toBeNull();
  });

  it("removing a student also removes their sessions and codes", async () => {
    process.env.EMAIL_TRANSPORT = "console";
    const parent = await makeParent();
    const res = await createStudent(parentActor(parent.id), details());
    if (!res.ok) throw new Error("setup");
    const sid = res.student.id;
    await createSession({ studentId: sid }, null);
    await issueCode({ parentId: parent.id, studentId: sid, purpose: "sign_in" });
    expect(await removeStudent(parentActor(parent.id), sid)).toBe(true);
    expect(await db.select().from(students).where(eq(students.id, sid))).toHaveLength(0);
    expect(await db.select().from(sessions).where(eq(sessions.studentId, sid))).toHaveLength(0);
    expect(await db.select().from(codes).where(eq(codes.studentId, sid))).toHaveLength(0);
  });
});
