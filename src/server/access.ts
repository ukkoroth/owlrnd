import "server-only";
import { and, asc, eq, gt, isNull, sql } from "drizzle-orm";
import { rules } from "@/config/rules";
import { randomToken, sha256 } from "./auth/crypto";
import { db } from "./db";
import { accessRequests, invitations, parents } from "./db/schema";
import { emailSender } from "./email";
import { env } from "./env";

/**
 * Closed beta (docs/release-plan.md, Phase 1 item 1).
 * 1. A visitor asks for access on /get-access; the request is recorded (and announced to OWNER_EMAIL if set).
 * 2. The owner runs `npm run invite -- <email>` (or `--pending`); the person gets a single-use sign-up link.
 * 3. Sign-up (1a) needs that link while rules.access.inviteOnly is on. The invitation is claimed by the new,
 *    unverified parent at sign-up and used up once they verify their email (1b).
 */

const lower = (email: string) => email.trim().toLowerCase();

// ── Access requests ─────────────────────────────────────────────────────────

export async function recordAccessRequest(input: { name: string; email: string; note: string | null }) {
  // Asking again with the same email updates the earlier request (unique on lower(email)).
  const [existing] = await db
    .select({ id: accessRequests.id, status: accessRequests.status })
    .from(accessRequests)
    .where(eq(sql`lower(${accessRequests.email})`, lower(input.email)));
  let status = existing?.status ?? "pending";
  if (existing) {
    await db.update(accessRequests).set({ name: input.name, note: input.note }).where(eq(accessRequests.id, existing.id));
  } else {
    await db.insert(accessRequests).values(input).onConflictDoNothing();
    status = "pending";
  }

  const owner = env().OWNER_EMAIL;
  if (owner) {
    // A failed notice must not lose the request: it is already recorded.
    await emailSender()
      .send({
        to: owner,
        subject: `owlrnd access request: ${input.name}`,
        text: [
          `${input.name} <${input.email}> asked for access to owlrnd.`,
          input.note ? `\nTheir note:\n${input.note}` : "",
          `\nStatus: ${status}${existing ? " (asked before)" : ""}`,
          `\nTo invite them: npm run invite -- ${input.email}`,
          `To see everyone waiting: npm run access -- list`,
        ].join("\n"),
      })
      .catch((err) => console.error("[owlrnd access] owner notice failed", err));
  }
}

export async function listAccessRequests(status?: "pending" | "invited") {
  return db
    .select()
    .from(accessRequests)
    .where(status ? eq(accessRequests.status, status) : undefined)
    .orderBy(asc(accessRequests.createdAt));
}

// ── Invitations ─────────────────────────────────────────────────────────────

export function invitationLink(token: string) {
  return `${env().APP_URL}/sign-up?invite=${encodeURIComponent(token)}`;
}

export function renderInvitationEmail(name: string | null, link: string, days: number) {
  return {
    subject: "Your invitation to owlrnd",
    text: [
      name ? `Hi ${name},` : "Hi,",
      "",
      "Thanks for your interest in owlrnd. You're invited to the closed beta.",
      "",
      "Create your parent account with this link:",
      "",
      `    ${link}`,
      "",
      `The link works once and expires in ${days} days.`,
      "After you sign up you can add your child and set up their first track.",
      "",
      "owlrnd",
    ].join("\n"),
  };
}

/** Creates an invitation, emails the link and marks any access request for that email as invited. */
export async function invite(email: string, now = new Date()): Promise<{ link: string; expiresAt: Date }> {
  const token = randomToken();
  const days = rules.access.invitationDays;
  const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  await db.insert(invitations).values({ email: email.trim(), tokenHash: sha256(token), expiresAt });

  const [request] = await db
    .update(accessRequests)
    .set({ status: "invited", invitedAt: now })
    .where(eq(sql`lower(${accessRequests.email})`, lower(email)))
    .returning({ name: accessRequests.name });

  const link = invitationLink(token);
  await emailSender().send({ to: email.trim(), ...renderInvitationEmail(request?.name ?? null, link, days) });
  return { link, expiresAt };
}

export type InvitationCheck = { ok: true; id: string; email: string } | { ok: false; reason: "missing" | "invalid" };

/** A link is good while it has not been used up and has not expired. Claiming it at sign-up doesn't use it up. */
export async function checkInvitation(token: string | null | undefined, now = new Date()): Promise<InvitationCheck> {
  if (!token) return { ok: false, reason: "missing" };
  const [row] = await db
    .select({ id: invitations.id, email: invitations.email })
    .from(invitations)
    .where(and(eq(invitations.tokenHash, sha256(token)), isNull(invitations.usedAt), gt(invitations.expiresAt, now)));
  return row ? { ok: true, ...row } : { ok: false, reason: "invalid" };
}

/** Sign-up (1a): the new, unverified parent holds the invitation until they verify. */
export async function claimInvitation(invitationId: string, parentId: string) {
  await db.update(invitations).set({ claimedByParentId: parentId }).where(eq(invitations.id, invitationId));
}

/** "Use a different email" (1b → 1a) keeps the invitation the account was started with. */
export async function hasOpenClaim(parentId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: invitations.id })
    .from(invitations)
    .innerJoin(parents, eq(parents.id, invitations.claimedByParentId))
    .where(and(eq(invitations.claimedByParentId, parentId), isNull(invitations.usedAt), isNull(parents.emailVerifiedAt)));
  return !!row;
}

/** Verify email (1b): the invitation is used up. */
export async function consumeInvitation(parentId: string, now = new Date()) {
  await db
    .update(invitations)
    .set({ usedAt: now })
    .where(and(eq(invitations.claimedByParentId, parentId), isNull(invitations.usedAt)));
}
