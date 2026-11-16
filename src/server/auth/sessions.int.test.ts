import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { cleanup, makeParent, makeSelfLearner, makeStudent } from "../../../tests/db-helpers";
import { db } from "../db";
import { parents, sessions, students } from "../db/schema";
import { deleteParent, upsertUnverifiedParent } from "./accounts";
import { createSession, revokeAllSessions, revokeSession, validateSession } from "./sessions";

afterAll(cleanup);

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;
const T0 = new Date("2030-01-01T09:00:00Z");
const at = (ms: number) => new Date(T0.getTime() + ms);

describe("sessions", () => {
  it("returns the parent or student for a valid token", async () => {
    const parent = await makeParent({ name: "Atticus" });
    const student = await makeStudent(parent.id, { name: "Scout" });
    const pt = await createSession({ parentId: parent.id }, "ua", T0);
    const st = await createSession({ studentId: student.id }, "ua", T0);
    expect((await validateSession(pt, at(1000)))).toMatchObject({ role: "parent", parent: { name: "Atticus" } });
    expect((await validateSession(st, at(1000)))).toMatchObject({ role: "student", student: { name: "Scout" }, parent: { name: "Atticus" } });
    expect(await validateSession("not-a-token", at(1000))).toBeNull();
  });

  it("parents expire after 7 days without use, and slide while in use", async () => {
    const parent = await makeParent();
    const idle = await createSession({ parentId: parent.id }, null, T0);
    expect(await validateSession(idle, at(7 * DAY - 1000))).not.toBeNull(); // used just before expiry → slides
    expect(await validateSession(idle, at(13 * DAY))).not.toBeNull();
    expect(await validateSession(idle, at(21 * DAY))).toBeNull();
  });

  it("self-managed learners expire after 7 days without use", async () => {
    const learner = await makeSelfLearner();
    const t = await createSession({ studentId: learner.id }, null, T0);
    expect(await validateSession(t, at(1000))).toMatchObject({ role: "student", student: { id: learner.id }, parent: null });
    expect(await validateSession(t, at(7 * DAY + 2000))).toBeNull();
  });

  it("parent-managed learners expire after 12 hours without use", async () => {
    const parent = await makeParent();
    const child = await makeStudent(parent.id);
    const t = await createSession({ studentId: child.id }, null, T0);
    expect(await validateSession(t, at(11 * HOUR))).not.toBeNull(); // slides
    expect(await validateSession(t, at(22 * HOUR))).not.toBeNull();
    expect(await validateSession(t, at(35 * HOUR))).toBeNull(); // 13 hours idle
  });

  it("a session opened under a longer rule ends once idle past the current rule", async () => {
    const parent = await makeParent();
    const child = await makeStudent(parent.id);
    const t = await createSession({ studentId: child.id }, null, T0);
    // As if created under the 0.1 rule (30 days).
    await db.update(sessions).set({ expiresAt: at(30 * DAY) }).where(eq(sessions.studentId, child.id));
    expect(await validateSession(t, at(13 * HOUR))).toBeNull();
  });

  it("is ended by sign out, and by revoking all sessions except the current one", async () => {
    const parent = await makeParent();
    const a = await createSession({ parentId: parent.id }, null, T0);
    const b = await createSession({ parentId: parent.id }, null, T0);
    const c = await createSession({ parentId: parent.id }, null, T0);
    await revokeSession(a);
    expect(await validateSession(a, at(1000))).toBeNull();
    const current = (await validateSession(b, at(1000)))!;
    await revokeAllSessions({ parentId: parent.id }, current.sessionId);
    expect(await validateSession(b, at(1000))).not.toBeNull();
    expect(await validateSession(c, at(1000))).toBeNull();
  });
});

describe("accounts", () => {
  it("deleting a parent removes their students and sessions", async () => {
    const parent = await makeParent();
    const student = await makeStudent(parent.id);
    await createSession({ studentId: student.id }, null, T0);
    await deleteParent(parent.id);
    expect(await db.select().from(students).where(eq(students.id, student.id))).toHaveLength(0);
    expect(await db.select().from(sessions).where(eq(sessions.studentId, student.id))).toHaveLength(0);
  });

  it("sign-up refuses an email that a verified parent already uses", async () => {
    const parent = await makeParent();
    const res = await upsertUnverifiedParent({ name: "X", email: parent.email.toUpperCase(), passwordHash: "x", timeZone: "UTC" }, null);
    expect(res).toEqual({ ok: false, reason: "email_taken" });
  });

  it("sign-up replaces an earlier unverified sign-up for the same email", async () => {
    const first = await makeParent({ emailVerifiedAt: null });
    const res = await upsertUnverifiedParent({ name: "Second", email: first.email, passwordHash: "x", timeZone: "UTC" }, null);
    expect(res.ok).toBe(true);
    const rows = await db.select().from(parents).where(eq(parents.email, first.email));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe("Second");
    if (res.ok) await deleteParent(res.parentId);
  });

  it("'Use a different email' updates the pending account instead of creating another", async () => {
    const mine = await makeParent({ emailVerifiedAt: null });
    const res = await upsertUnverifiedParent({ name: "Me", email: `other-${mine.email}`, passwordHash: "x", timeZone: "UTC" }, mine.id);
    expect(res).toEqual({ ok: true, parentId: mine.id });
  });
});
