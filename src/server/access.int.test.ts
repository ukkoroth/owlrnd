import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { cleanup, makeParent, uniqueEmail } from "../../tests/db-helpers";
import { checkInvitation, claimInvitation, consumeInvitation, hasOpenClaim, invite, listAccessRequests, recordAccessRequest, renderInvitationEmail } from "./access";
import { db } from "./db";
import { accessRequests, invitations } from "./db/schema";

const emails: string[] = [];
const email = () => {
  const e = uniqueEmail("access");
  emails.push(e.toLowerCase());
  return e;
};

afterAll(async () => {
  await db.delete(invitations).where(inArray(sql`lower(${invitations.email})`, emails));
  await db.delete(accessRequests).where(inArray(sql`lower(${accessRequests.email})`, emails));
  await cleanup();
});

const DAY = 24 * 60 * 60_000;
const tokenOf = (link: string) => new URL(link).searchParams.get("invite")!;

describe("access requests", () => {
  it("records a request once per email; asking again updates it", async () => {
    const e = email();
    await recordAccessRequest({ name: "Atticus", email: e, note: "Class 10, physics" });
    await recordAccessRequest({ name: "Atticus F", email: e.toUpperCase(), note: null });
    const rows = (await listAccessRequests()).filter((r) => r.email.toLowerCase() === e.toLowerCase());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Atticus F", note: null, status: "pending" });
  });

  it("inviting marks the request invited and leaves it off the pending list", async () => {
    const e = email();
    await recordAccessRequest({ name: "Asha", email: e, note: null });
    expect((await listAccessRequests("pending")).some((r) => r.email === e)).toBe(true);
    await invite(e);
    expect((await listAccessRequests("pending")).some((r) => r.email === e)).toBe(false);
    const [row] = await db.select().from(accessRequests).where(eq(accessRequests.email, e));
    expect(row).toMatchObject({ status: "invited" });
    expect(row!.invitedAt).not.toBeNull();
  });
});

describe("invitations", () => {
  it("a link is good until it expires, and only the hash is stored", async () => {
    const e = email();
    const now = new Date();
    const { link, expiresAt } = await invite(e, now);
    const token = tokenOf(link);
    expect(link).toContain("/sign-up?invite=");
    expect(expiresAt.getTime() - now.getTime()).toBe(14 * DAY);
    expect(await checkInvitation(token)).toMatchObject({ ok: true, email: e });
    expect(await checkInvitation(token, new Date(now.getTime() + 15 * DAY))).toEqual({ ok: false, reason: "invalid" });
    expect(await checkInvitation("not-a-token")).toEqual({ ok: false, reason: "invalid" });
    expect(await checkInvitation(undefined)).toEqual({ ok: false, reason: "missing" });
    const stored = await db.select({ h: invitations.tokenHash }).from(invitations).where(eq(invitations.email, e));
    expect(stored[0]!.h).not.toBe(token);
  });

  it("is held by the unverified parent at sign-up and used up when they verify", async () => {
    const e = email();
    const { link } = await invite(e);
    const token = tokenOf(link);
    const parent = await makeParent({ email: e, emailVerifiedAt: null });

    const check = await checkInvitation(token);
    if (!check.ok) throw new Error("expected a valid invitation");
    await claimInvitation(check.id, parent.id);
    expect(await hasOpenClaim(parent.id)).toBe(true);
    // Claimed but not verified: the link still works (for example after the sign-up step timed out).
    expect((await checkInvitation(token)).ok).toBe(true);

    await consumeInvitation(parent.id);
    expect(await checkInvitation(token)).toEqual({ ok: false, reason: "invalid" });
    expect(await hasOpenClaim(parent.id)).toBe(false);
  });

  it("the email names the person when they asked for access", () => {
    const { subject, text } = renderInvitationEmail("Asha", "https://owlrnd.example/sign-up?invite=abc", 14);
    expect(subject).toBe("Your invitation to owlrnd");
    expect(text).toContain("Hi Asha,");
    expect(text).toContain("https://owlrnd.example/sign-up?invite=abc");
    expect(text).toContain("expires in 14 days");
  });
});
