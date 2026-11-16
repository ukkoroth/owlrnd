import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { cleanup, makeParent, makeSelfLearner, makeStudent } from "../../../tests/db-helpers";
import { db } from "../db";
import { parents, sessions, students } from "../db/schema";
import { deleteParent, upsertUnverifiedParent } from "./accounts";
import { createSession, revokeAllSessions, revokeSession, validateSession } from "./sessions";

afterAll(cleanup);

const DAY = 24 * 60 * 60_000;
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

  it("every account type expires after 30 days without use, and slides while in use", async () => {
    const parent = await makeParent();
    const child = await makeStudent(parent.id);
    const learner = await makeSelfLearner();
    for (const owner of [{ parentId: parent.id }, { studentId: child.id }, { studentId: learner.id }]) {
      const t = await createSession(owner, null, T0);
      expect(await validateSession(t, at(30 * DAY - 1000))).not.toBeNull(); // used just before expiry → slides
      expect(await validateSession(t, at(59 * DAY))).not.toBeNull();
      expect(await validateSession(t, at(90 * DAY))).toBeNull();
    }
  });

  it("a self-managed learner's session has no parent", async () => {
    const learner = await makeSelfLearner();
    const t = await createSession({ studentId: learner.id }, null, T0);
    expect(await validateSession(t, at(1000))).toMatchObject({ role: "student", student: { id: learner.id }, parent: null });
  });

  it("a session stored with a longer expiry still ends once idle past the rule", async () => {
    const parent = await makeParent();
    const child = await makeStudent(parent.id);
    const t = await createSession({ studentId: child.id }, null, T0);
    await db.update(sessions).set({ expiresAt: at(365 * DAY) }).where(eq(sessions.studentId, child.id));
    expect(await validateSession(t, at(31 * DAY))).toBeNull();
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
