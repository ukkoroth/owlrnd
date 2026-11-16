import { and, eq, gte, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { holderForParent } from "@/domain/accounts";
import { cleanup, learnerActor, makeParent, makeSelfLearner, makeStudent, makeTrackWithExam, parentActor, uniqueEmail } from "../../tests/db-helpers";
import { latestCode } from "../../tests/mailpit";
import { allowanceOf, ALLOWANCE_USED_UP, chatBlocked, examWriteBlocked, withAiContext, recordUsage } from "./ai/usage";
import { changeAccountEmail, deleteOwnAccount, emailInUseByOther, findAccount, ownAccount, upsertUnverifiedLearner, upsertUnverifiedParent } from "./auth/accounts";
import { issueCode, verifyCode, type CodeOwner } from "./auth/codes";
import { db } from "./db";
import { aiUsage, parents, students, trackMessages, tracks } from "./db/schema";
import { loadLearner } from "./learners";
import { listStudents, removeStudent, setStudentPassword, updateStudentDetails } from "./students";
import { createTrackFromDraft, discardDraft, getDraftChat, listTracks, retryExamWriting, sendChatTurn, setTrackPaused } from "./tracks";
import { applyTrackUpdate, archiveTrack, discardUpdateChat, examHistory, getUpdateChat, sendUpdateTurn } from "./trackUpdates";

// M7 (0.2 plan): one permission policy, codes to the account holder, the AI allowance per holder.
beforeAll(() => {
  process.env.EMAIL_TRANSPORT = "smtp";
  process.env.OWLRND_FAKE_AI = "1";
});
afterAll(cleanup);

describe("codes go to the account holder (editions §2.3)", () => {
  it("a self-managed learner finds their account by email and gets the code at their own email", async () => {
    const learner = await makeSelfLearner();
    const account = await findAccount({ kind: "email", value: learner.email!.toUpperCase() });
    expect(account).toMatchObject({ kind: "student", student: { id: learner.id }, parent: null });

    const owner: CodeOwner = { parentId: null, studentId: learner.id, purpose: "sign_in" };
    const sentAt = new Date();
    const res = await issueCode(owner);
    expect(res).toEqual({ sent: true, sentTo: learner.email });
    const code = await latestCode(learner.email!, { after: new Date(sentAt.getTime() - 50) });
    expect(await verifyCode(owner, code)).toEqual({ result: "ok", newEmail: null });
  });

  it("a parent-managed learner's code still goes to the parent", async () => {
    const parent = await makeParent();
    const child = await makeStudent(parent.id);
    expect(await issueCode({ parentId: parent.id, studentId: child.id, purpose: "sign_in" })).toEqual({ sent: true, sentTo: parent.email });
  });

  it("refuses a code owner that doesn't match the learner", async () => {
    const learner = await makeSelfLearner();
    const parent = await makeParent();
    await expect(issueCode({ parentId: parent.id, studentId: learner.id, purpose: "sign_in" })).rejects.toThrow();
  });

  it("an email belongs to one account: a parent's email isn't looked up as a learner, and usernames are children only", async () => {
    const parent = await makeParent();
    expect(await findAccount({ kind: "email", value: parent.email })).toMatchObject({ kind: "parent" });
    const learner = await makeSelfLearner();
    expect(await findAccount({ kind: "username", value: learner.email! })).toBeNull();
  });
});

describe("the server refuses what the policy refuses", () => {
  it("a parent-managed learner can't change tracks, even their own", async () => {
    const parent = await makeParent();
    const child = await makeStudent(parent.id);
    const { trackId } = await makeTrackWithExam(parent.id, child.id);
    const me = learnerActor(child);

    expect(await getDraftChat(me, child.id)).toBeNull();
    expect(await sendChatTurn(me, child.id, "Add chemistry.", [])).toEqual({ ok: false, error: "Student not found." });
    expect(await createTrackFromDraft(me, child.id)).toMatchObject({ ok: false });
    expect(await setTrackPaused(me, trackId, true)).toBeNull();
    expect(await retryExamWriting(me, trackId)).toBeNull();
    expect(await getUpdateChat(me, trackId)).toBeNull();
    expect(await sendUpdateTurn(me, trackId, "More topics.", [])).toEqual({ ok: false, error: "Track not found." });
    expect(await applyTrackUpdate(me, trackId)).toMatchObject({ ok: false });
    expect(await archiveTrack(me, trackId)).toBe(false);
    await discardDraft(me, child.id);
    await discardUpdateChat(me, trackId);
    const [t] = await db.select().from(tracks).where(eq(tracks.id, trackId));
    expect(t!.status).toBe("active");

    // They can still see their own progress.
    expect(await listTracks(me, child.id)).toHaveLength(1);
    expect(await examHistory(me, trackId)).not.toBeNull();
    // And can't manage themselves or siblings as children.
    expect(await setStudentPassword(me, child.id, "new-password-1")).toBe(false);
    expect(await listStudents(me)).toEqual([]);
  });

  it("another family's parent is refused, and sees nothing", async () => {
    const parent = await makeParent();
    const child = await makeStudent(parent.id);
    const { trackId } = await makeTrackWithExam(parent.id, child.id);
    const stranger = parentActor((await makeParent()).id);

    expect(await listTracks(stranger, child.id)).toBeNull();
    expect(await setTrackPaused(stranger, trackId, true)).toBeNull();
    expect(await examHistory(stranger, trackId)).toBeNull();
    expect(await updateStudentDetails(stranger, child.id, { name: "X", className: "1", username: "xx-taken" })).toEqual({ ok: false, reason: "not_found" });
    expect(await removeStudent(stranger, child.id)).toBe(false);
    expect(await db.select().from(students).where(eq(students.id, child.id))).toHaveLength(1);
  });

  it("a parent can't act on a self-managed learner", async () => {
    const learner = await makeSelfLearner();
    const parent = parentActor((await makeParent()).id);
    expect(await listTracks(parent, learner.id)).toBeNull();
    expect(await sendChatTurn(parent, learner.id, "Physics.", [])).toMatchObject({ ok: false });
  });

  it("a self-managed learner sets up and manages their own track; their chat turns are theirs", async () => {
    const learner = await makeSelfLearner();
    const me = learnerActor(learner);
    const { trackId } = await makeTrackWithExam(me, learner.id);

    const msgs = await db.select().from(trackMessages).where(eq(trackMessages.trackId, trackId));
    expect(new Set(msgs.map((m) => m.author))).toEqual(new Set(["learner", "ai"]));
    expect(await setTrackPaused(me, trackId, true)).not.toBeNull();
    expect(await setTrackPaused(me, trackId, false)).not.toBeNull();
    expect(await listTracks(me, learner.id)).toHaveLength(1);


    // Another learner can't touch it.
    const other = learnerActor(await makeSelfLearner());
    expect(await setTrackPaused(other, trackId, true)).toBeNull();
  });
});

describe("AI allowance per account holder (demo, $10)", () => {
  // Recorded as now, then moved to January 2020: the allowance counts all time, and test spend stays out of the
  // real month's budget (which would pause chats in the dev database).
  const spend = async (ctx: Parameters<typeof withAiContext>[0], outputTokens: number) => {
    const before = new Date(Date.now() - 1000);
    await withAiContext(ctx, () => recordUsage("claude-opus-5-5", { input_tokens: 0, output_tokens: outputTokens }));
    await db.update(aiUsage).set({ createdAt: new Date("2020-01-15T00:00:00Z") }).where(and(gte(aiUsage.createdAt, before), eq(aiUsage.inputTokens, 0)));
  };

  it("counts a family's spend and blocks chats and exam writing at the limit; an override lifts it", async () => {
    const parent = await makeParent();
    const child = await makeStudent(parent.id);
    const holder = holderForParent(parent);
    expect((await allowanceOf(holder)).usedUsd).toBe(0);

    await spend({ purpose: "track_chat", holder: { parentId: parent.id }, studentId: child.id }, 400_000); // $8 at $20/M output
    expect(await allowanceOf(holder)).toMatchObject({ level: "warn", usedUp: false });
    expect(await chatBlocked(holder)).toBeNull();

    await spend({ purpose: "write_exam", holder: { parentId: parent.id }, studentId: child.id }, 100_000); // $10 total
    expect(await allowanceOf(holder)).toMatchObject({ level: "used_up", usedUp: true, percent: 100 });
    expect(await chatBlocked(holder)).toBe(ALLOWANCE_USED_UP);
    expect((await examWriteBlocked(holder))?.reason).toBe("allowance");
    expect(await sendChatTurn(parentActor(parent.id), child.id, "Physics.", [])).toEqual({ ok: false, error: ALLOWANCE_USED_UP });

    await db.update(parents).set({ aiLimitUsd: 25 }).where(eq(parents.id, parent.id));
    const raised = holderForParent({ ...parent, aiLimitUsd: 25 });
    expect(await allowanceOf(raised)).toMatchObject({ limitUsd: 25, usedUp: false });
    expect(await chatBlocked(raised)).toBeNull();
  });

  it("a self-managed learner has their own allowance, separate from any family", async () => {
    const learner = await makeSelfLearner();
    const { holder } = (await loadLearner(learner.id))!;
    await spend({ purpose: "track_chat", holder: { studentId: learner.id } }, 500_000); // $10
    expect(await allowanceOf(holder)).toMatchObject({ usedUp: true });
    // Recorded against the learner, with no family.
    const rows = await db.select().from(aiUsage).where(eq(aiUsage.studentId, learner.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.parentId).toBeNull();

    const parent = await makeParent();
    expect(await allowanceOf(holderForParent(parent))).toMatchObject({ usedUsd: 0 });
  });
});

describe("sign-up For me: one email, one account (owner, 2026-11-16)", () => {
  const signUp = (email: string, pending: string | null = null) =>
    upsertUnverifiedLearner(
      { name: "Rancho", email, passwordHash: "x", timeZone: "UTC", dateOfBirth: "2000-03-12", consentedAt: new Date(), consentVersion: "test" },
      pending,
    );
  const learnersWith = (email: string) => db.select().from(students).where(eq(sql`lower(${students.email})`, email.toLowerCase()));

  it("creates an unverified self-managed learner, and reuses it for 'Use a different email'", async () => {
    const email = uniqueEmail("l");
    const res = await signUp(email);
    if (!res.ok) throw new Error("expected ok");
    const [row] = await learnersWith(email);
    expect(row).toMatchObject({ type: "self_managed", parentId: null, username: null, emailVerifiedAt: null, dateOfBirth: "2000-03-12" });

    const other = uniqueEmail("l");
    const again = await signUp(other, res.studentId);
    expect(again).toEqual({ ok: true, studentId: res.studentId });
    expect(await learnersWith(email)).toHaveLength(0);
    await db.delete(students).where(eq(students.id, res.studentId));
  });

  it("refuses an email a verified parent or learner uses", async () => {
    const parent = await makeParent();
    expect(await signUp(parent.email)).toEqual({ ok: false, reason: "email_taken" });
    const learner = await makeSelfLearner();
    expect(await signUp(learner.email!.toUpperCase())).toEqual({ ok: false, reason: "email_taken" });
  });

  it("replaces an unverified sign-up of either kind with the same email", async () => {
    const parent = await makeParent({ emailVerifiedAt: null });
    const res = await signUp(parent.email);
    expect(res.ok).toBe(true);
    expect(await db.select().from(parents).where(eq(parents.id, parent.id))).toHaveLength(0);
    if (res.ok) await db.delete(students).where(eq(students.id, res.studentId));

    const learner = await makeSelfLearner({ emailVerifiedAt: null });
    const mine = await signUp(learner.email!);
    expect(mine.ok).toBe(true);
    expect(await db.select().from(students).where(eq(students.id, learner.id))).toHaveLength(0);
    if (mine.ok) await db.delete(students).where(eq(students.id, mine.studentId));
  });

  it("a parent can't sign up with a verified learner's email; an unverified learner gives way", async () => {
    const learner = await makeSelfLearner();
    expect(await upsertUnverifiedParent({ name: "A", email: learner.email!, passwordHash: "x", timeZone: "UTC" }, null)).toEqual({ ok: false, reason: "email_taken" });

    const pendingLearner = await makeSelfLearner({ emailVerifiedAt: null });
    const res = await upsertUnverifiedParent({ name: "A", email: pendingLearner.email!, passwordHash: "x", timeZone: "UTC" }, null);
    expect(res.ok).toBe(true);
    expect(await db.select().from(students).where(eq(students.id, pendingLearner.id))).toHaveLength(0);
    if (res.ok) await db.delete(parents).where(eq(parents.id, res.parentId));
  });
});

describe("M9: a learner's own tracks and account", () => {
  it("listTracks gives the exam waiting to be taken, for 'Start exam N'", async () => {
    const learner = await makeSelfLearner();
    const me = learnerActor(learner);
    const { trackId, examId } = await makeTrackWithExam(me, learner.id);
    const [t] = (await listTracks(me, learner.id))!;
    expect(t).toMatchObject({ id: trackId, readyExam: { id: examId, number: 1, started: false } });
  });

  it("a parent-managed learner holds no account of their own", async () => {
    const parent = await makeParent();
    const child = await makeStudent(parent.id);
    expect(await ownAccount(learnerActor(child))).toBeNull();
    expect(await ownAccount(parentActor(parent.id))).toMatchObject({ kind: "parent", id: parent.id });
  });

  it("a learner changes their email, but not to one another account uses", async () => {
    const learner = await makeSelfLearner();
    const account = (await ownAccount(learnerActor(learner)))!;
    const parent = await makeParent();
    expect(await emailInUseByOther(account, parent.email)).toBe(true);
    expect(await changeAccountEmail(account, parent.email)).toBe(false);

    const fresh = uniqueEmail("l");
    expect(await emailInUseByOther(account, fresh)).toBe(false);
    expect(await changeAccountEmail(account, fresh)).toBe(true);
    expect(await findAccount({ kind: "email", value: fresh })).toMatchObject({ kind: "student", student: { id: learner.id } });
  });

  it("deleting a learner's account removes them and their tracks; a child can't delete theirs", async () => {
    const learner = await makeSelfLearner();
    const me = learnerActor(learner);
    const { trackId } = await makeTrackWithExam(me, learner.id);
    expect(await deleteOwnAccount(me, (await ownAccount(me))!)).toBe(true);
    expect(await db.select().from(students).where(eq(students.id, learner.id))).toHaveLength(0);
    expect(await db.select().from(tracks).where(eq(tracks.id, trackId))).toHaveLength(0);

    const parent = await makeParent();
    const child = await makeStudent(parent.id);
    const fakeAccount = { kind: "learner" as const, id: child.id, name: "x", email: "x", passwordHash: "x", codeOwner: { parentId: null, studentId: child.id } };
    expect(await deleteOwnAccount(learnerActor(child), fakeAccount)).toBe(false);
    expect(await db.select().from(students).where(eq(students.id, child.id))).toHaveLength(1);
  });
});
