import { and, desc, eq, isNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanup, makeParent, makeStudent } from "../../../tests/db-helpers";
import { latestCode } from "../../../tests/mailpit";
import { db } from "../db";
import { codes } from "../db/schema";
import { issueCode, verifyCode, type CodeOwner } from "./codes";

// Real Postgres + Mailpit. Clock is injected through the `now` arguments.
beforeAll(() => {
  process.env.EMAIL_TRANSPORT = "smtp";
});
afterAll(cleanup);

const T0 = new Date("2030-01-01T09:00:00Z");
const after = (min: number) => new Date(T0.getTime() + min * 60_000);

async function send(owner: CodeOwner, now = T0) {
  const sentAt = new Date();
  const res = await issueCode(owner, now);
  expect(res.sent).toBe(true);
  if (!res.sent) throw new Error("not sent");
  return latestCode(res.sentTo, { after: new Date(sentAt.getTime() - 50) });
}

const wrongFor = (code: string) => (code === "000000" ? "111111" : "000000");

describe("codes (rules §1)", () => {
  it("accepts the emailed code once", async () => {
    const parent = await makeParent();
    const owner: CodeOwner = { parentId: parent.id, studentId: null, purpose: "sign_in" };
    const code = await send(owner);
    expect(await verifyCode(owner, code, after(1))).toEqual({ result: "ok", newEmail: null });
    expect(await verifyCode(owner, code, after(2))).toEqual({ result: "used" });
  });

  it("a new code makes the earlier one invalid", async () => {
    const parent = await makeParent();
    const owner: CodeOwner = { parentId: parent.id, studentId: null, purpose: "sign_in" };
    const first = await send(owner);
    const second = await send(owner, after(1));
    const firstRow = await db
      .select()
      .from(codes)
      .where(eq(codes.parentId, parent.id))
      .orderBy(codes.createdAt)
      .limit(1);
    expect(firstRow[0]!.invalidatedAt).not.toBeNull();
    if (first !== second) expect((await verifyCode(owner, first, after(2))).result).toBe("wrong");
    expect((await verifyCode(owner, second, after(2))).result).toBe("ok");
  });

  it("a student's code does not cancel the parent's", async () => {
    const parent = await makeParent();
    const student = await makeStudent(parent.id);
    const parentOwner: CodeOwner = { parentId: parent.id, studentId: null, purpose: "sign_in" };
    const parentCode = await send(parentOwner);
    await send({ parentId: parent.id, studentId: student.id, purpose: "sign_in" }, after(1));
    expect((await verifyCode(parentOwner, parentCode, after(2))).result).toBe("ok");
  });

  it("emails a student's code to the parent", async () => {
    const parent = await makeParent();
    const student = await makeStudent(parent.id, { name: "Scout" });
    const res = await issueCode({ parentId: parent.id, studentId: student.id, purpose: "sign_in" }, T0);
    expect(res).toEqual({ sent: true, sentTo: parent.email });
  });

  it("expires after 10 minutes", async () => {
    const parent = await makeParent();
    const owner: CodeOwner = { parentId: parent.id, studentId: null, purpose: "sign_in" };
    const code = await send(owner);
    expect(await verifyCode(owner, code, after(10))).toEqual({ result: "expired" });
  });

  it("counts down tries, then sends a new code automatically on the 3rd wrong try (5f)", async () => {
    const parent = await makeParent();
    const owner: CodeOwner = { parentId: parent.id, studentId: null, purpose: "sign_in" };
    const code = await send(owner);
    const wrong = wrongFor(code);
    expect(await verifyCode(owner, wrong, after(1))).toEqual({ result: "wrong", triesLeft: 2 });
    expect(await verifyCode(owner, wrong, after(1))).toEqual({ result: "wrong", triesLeft: 1 });
    const sentAt = new Date();
    expect(await verifyCode(owner, wrong, after(1))).toEqual({ result: "locked", newCodeSent: true });
    // The old code is dead; the new emailed code works.
    const fresh = await latestCode(parent.email, { after: new Date(sentAt.getTime() - 50) });
    const open = await db
      .select()
      .from(codes)
      .where(and(eq(codes.parentId, parent.id), isNull(codes.invalidatedAt)))
      .orderBy(desc(codes.createdAt));
    expect(open).toHaveLength(1);
    expect((await verifyCode(owner, fresh, after(2))).result).toBe("ok");
  });

  it("refuses the 6th send in an hour, and allows it again after the hour", async () => {
    const parent = await makeParent();
    const owner: CodeOwner = { parentId: parent.id, studentId: null, purpose: "reset_password" };
    for (let i = 0; i < 5; i++) expect((await issueCode(owner, after(i))).sent).toBe(true);
    expect(await issueCode(owner, after(5))).toEqual({ sent: false, reason: "rate_limited" });
    expect((await issueCode(owner, after(61))).sent).toBe(true);
  });

  it("lets only one of two simultaneous submits of the right code succeed", async () => {
    const parent = await makeParent();
    const owner: CodeOwner = { parentId: parent.id, studentId: null, purpose: "sign_in" };
    const code = await send(owner);
    const results = await Promise.all([verifyCode(owner, code, after(1)), verifyCode(owner, code, after(1))]);
    expect(results.map((r) => r.result).sort()).toEqual(["ok", "used"]);
  });

  it("sends an email-change code to the new address and returns it on success", async () => {
    const parent = await makeParent();
    const owner: CodeOwner = { parentId: parent.id, studentId: null, purpose: "change_email" };
    const newEmail = `new-${parent.email}`;
    const sentAt = new Date();
    const res = await issueCode({ ...owner, newEmail }, T0);
    expect(res).toEqual({ sent: true, sentTo: newEmail });
    const code = await latestCode(newEmail, { after: new Date(sentAt.getTime() - 50) });
    expect(await verifyCode(owner, code, after(1))).toEqual({ result: "ok", newEmail });
  });

  it("does not use up a try on input that isn't 6 digits", async () => {
    const parent = await makeParent();
    const owner: CodeOwner = { parentId: parent.id, studentId: null, purpose: "sign_in" };
    await send(owner);
    expect(await verifyCode(owner, "12", after(1))).toEqual({ result: "malformed" });
    const [row] = await db.select().from(codes).where(eq(codes.parentId, parent.id));
    expect(row!.triesLeft).toBe(3);
  });
});
