import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { rules } from "@/config/rules";
import { cleanup, learnerActor, makeSelfLearner, makeTrackWithExam, uniqueEmail } from "../../tests/db-helpers";
import { latestCode, latestLink, subjects } from "../../tests/mailpit";
import { db } from "./db";
import { consentRequests, jobs, students, tracks } from "./db/schema";
import { answerConsent, consentAudit, consentOverdueJob, consentReminderJob, learnerConsent, openRequest, requestConsent, resendConsent, sendParentCode } from "./consent";

// M10 (editions §2.4): consent for an under-18 self-managed learner. Real Postgres + Mailpit.
beforeAll(() => {
  process.env.EMAIL_TRANSPORT = "smtp";
  process.env.OWLRND_FAKE_AI = "1";
});
afterAll(cleanup);

const consentRules = rules.consent as { under18Mode: string };
const savedMode = consentRules.under18Mode;
afterEach(() => {
  consentRules.under18Mode = savedMode;
});

const DAY = 24 * 60 * 60_000;
const year = new Date().getUTCFullYear();
/** A 15-year-old self-managed learner. */
const makeTeen = () => makeSelfLearner({ name: "Rancho", dateOfBirth: `${year - 15}-01-01` });
const tokenFrom = (link: string) => decodeURIComponent(link.split("/consent/")[1]!);

async function ask(learner: Awaited<ReturnType<typeof makeTeen>>, parentEmail = uniqueEmail("pa")) {
  const res = await requestConsent(learner, { parentName: "Shyamaldas", parentEmail });
  if (!res.ok) throw new Error(JSON.stringify(res.fieldErrors));
  const link = await latestLink(parentEmail, /https?:\/\/\S+\/consent\/\S+/);
  return { request: res.request, parentEmail, token: tokenFrom(link) };
}

async function codeFor(open: NonNullable<Awaited<ReturnType<typeof openRequest>>>) {
  const at = new Date(Date.now() - 50);
  await sendParentCode(open);
  return latestCode(open.request.parentEmail, { after: at });
}

describe("asking a parent", () => {
  it("emails the parent a link and schedules a reminder and the 30-day check; pending learners can practise", async () => {
    const learner = await makeTeen();
    expect((await learnerConsent(learner)).state).toBe("pending"); // not asked yet
    const { request, token } = await ask(learner);
    expect(await openRequest(token)).toMatchObject({ request: { id: request.id }, learner: { id: learner.id } });
    const queued = await db.select().from(jobs).where(eq(jobs.type, "consent_reminder"));
    expect(queued.some((j) => (j.payload as { requestId: string }).requestId === request.id)).toBe(true);
    expect(await learnerConsent(learner)).toMatchObject({ state: "pending", practiseAllowed: true });
    expect((await consentAudit({ studentId: learner.id })).map((e) => e.kind)).toEqual(["requested"]);
  });

  it("refuses the learner's own email and another learner's", async () => {
    const learner = await makeTeen();
    expect(await requestConsent(learner, { parentName: "Me", parentEmail: learner.email! })).toMatchObject({ ok: false, fieldErrors: { parentEmail: expect.any(String) } });
    const other = await makeSelfLearner();
    expect(await requestConsent(learner, { parentName: "Friend", parentEmail: other.email! })).toMatchObject({ ok: false });
  });

  it("a new link (Resend) ends the earlier one", async () => {
    const learner = await makeTeen();
    const first = await ask(learner);
    const again = await resendConsent(learner);
    expect(again?.ok).toBe(true);
    expect(await openRequest(first.token)).toBeNull();
    const [old] = await db.select().from(consentRequests).where(eq(consentRequests.id, first.request.id));
    expect(old!.status).toBe("expired");
  });

  it("adults and 0.1 children don't need consent", async () => {
    expect((await learnerConsent(await makeSelfLearner({ dateOfBirth: "1990-01-01" }))).state).toBe("not_needed");
    expect((await learnerConsent(await makeSelfLearner({ dateOfBirth: null }))).state).toBe("not_needed");
  });
});

describe("the parent's answer (sm-1f)", () => {
  it("agreeing needs the right code, and records the level, policy version and progress view", async () => {
    const learner = await makeTeen();
    const { token } = await ask(learner);
    const open = (await openRequest(token))!;
    const code = await codeFor(open);
    const wrong = code === "000000" ? "111111" : "000000";
    expect(await answerConsent(token, { code: wrong, agree: true, progressView: true })).toEqual({ result: "wrong", triesLeft: 2 });
    expect(await answerConsent(token, { code, agree: true, progressView: true })).toEqual({ result: "agreed" });
    const [row] = await db.select().from(consentRequests).where(eq(consentRequests.id, open.request.id));
    expect(row).toMatchObject({ status: "agreed", verificationLevel: "email_code", progressView: true, policyVersion: expect.any(String) });
    expect((await learnerConsent(learner)).state).toBe("agreed");
    expect(await openRequest(token)).toBeNull(); // the link is used up
    expect((await consentAudit({ requestId: open.request.id })).map((e) => e.kind)).toEqual(expect.arrayContaining(["code_sent", "code_wrong", "code_verified", "agreed"]));
    expect(await subjects(learner.email!)).toContain("Your parent agreed: owlrnd is all set");
  });

  it("three wrong codes: the code stops working and a new one is sent", async () => {
    const learner = await makeTeen();
    const { token } = await ask(learner);
    const code = await codeFor((await openRequest(token))!);
    const wrong = code === "000000" ? "111111" : "000000";
    await answerConsent(token, { code: wrong, agree: true, progressView: false });
    await answerConsent(token, { code: wrong, agree: true, progressView: false });
    expect(await answerConsent(token, { code: wrong, agree: true, progressView: false })).toEqual({ result: "locked", newCodeSent: true });
    expect(await answerConsent(token, { code, agree: true, progressView: false })).toMatchObject({ result: "wrong" }); // the old code is gone
  });

  it("declining closes the learner's account and deletes their data; the audit record stays", async () => {
    const learner = await makeTeen();
    const { trackId } = await makeTrackWithExam(learnerActor(learner), learner.id);
    const { token, parentEmail } = await ask(learner);
    const open = (await openRequest(token))!;
    const code = await codeFor(open);
    expect(await answerConsent(token, { code, agree: false, progressView: false })).toEqual({ result: "declined" });
    expect(await db.select().from(students).where(eq(students.id, learner.id))).toHaveLength(0);
    expect(await db.select().from(tracks).where(eq(tracks.id, trackId))).toHaveLength(0);
    const audit = await consentAudit({ requestId: open.request.id });
    expect(audit.find((e) => e.kind === "declined")?.detail).toMatchObject({ parentEmail });
    expect(await subjects(learner.email!)).toContain("Your owlrnd account has been closed");
  });
});

describe("timing", () => {
  it("one reminder to the parent while unanswered", async () => {
    const learner = await makeTeen();
    const { request, parentEmail } = await ask(learner);
    await consentReminderJob({ requestId: request.id });
    await consentReminderJob({ requestId: request.id }); // already reminded: nothing
    expect((await subjects(parentEmail)).filter((s) => s.startsWith("Reminder:"))).toHaveLength(1);
  });

  it("no answer after 30 days pauses practice and logs it; exam writing waits", async () => {
    const learner = await makeTeen();
    const { request } = await ask(learner);
    await db.update(consentRequests).set({ createdAt: new Date(Date.now() - 31 * DAY) }).where(eq(consentRequests.id, request.id));
    expect(await learnerConsent(learner)).toMatchObject({ state: "overdue", practiseAllowed: false });
    await consentOverdueJob({ studentId: learner.id });
    expect((await consentAudit({ studentId: learner.id })).map((e) => e.kind)).toContain("paused_no_answer");
  });

  it("'block until consent' stops a pending learner from practising", async () => {
    const learner = await makeTeen();
    await ask(learner);
    consentRules.under18Mode = "block_until_consent";
    expect(await learnerConsent(learner)).toMatchObject({ state: "pending", practiseAllowed: false });
  });
});
