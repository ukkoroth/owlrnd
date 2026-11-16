import "server-only";
import { and, asc, count, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { POLICIES_VERSION } from "@/config/legal";
import { rules } from "@/config/rules";
import { canSendCode, checkCodeAttempt, codeExpiry, generateCode, initialTries, maskEmail, normalizeCodeInput } from "@/domain/codes";
import { consentState, linkExpiry, needsConsent, overdueAt, practiceAllowed, reminderAt, type ConsentState } from "@/domain/consent";
import { normalizeEmail, validateEmail, validateName } from "@/domain/identity";
import { todayIn } from "@/domain/tracks";
import { deleteSelfManagedLearner } from "./auth/accounts";
import { hmac, randomInt, safeEqual, sha256 } from "./auth/crypto";
import { db } from "./db";
import { consentEvents, consentRequests, students } from "./db/schema";
import { emailSender } from "./email";
import { env } from "./env";
import { enqueue } from "./jobs/queue";

// Parent consent for an under-18 self-managed learner (editions §2.4, 0.2 plan M10). The parent needs no account:
// they open a link from their email, prove they read that inbox with a 6-digit code (rules §1), and agree or
// decline. Every step is kept in consent_events as the audit record.

type Learner = typeof students.$inferSelect;
type Request = typeof consentRequests.$inferSelect;
type EventKind = (typeof consentEvents.$inferInsert)["kind"];

const DAY = 24 * 60 * 60_000;

// ── Links ───────────────────────────────────────────────────────────────────

/** The link token is derived from the request id with the app secret, so a reminder can rebuild the same link. */
const tokenFor = (requestId: string) => `${requestId}.${hmac(`consent:${requestId}`)}`;
const consentLink = (requestId: string) => `${env().APP_URL}/consent/${tokenFor(requestId)}`;

async function logEvent(kind: EventKind, r: { id: string | null; studentId: string | null }, detail?: Record<string, unknown>, at = new Date()) {
  await db.insert(consentEvents).values({ kind, requestId: r.id, studentId: r.studentId, detail: detail ?? null, at });
}

// ── State ───────────────────────────────────────────────────────────────────

export type LearnerConsent = { state: ConsentState; latest: Request | null; practiseAllowed: boolean };

/** Where a learner's consent stands. Learners 18 or over (and 0.1 children, who have no date of birth) don't need it. */
export async function learnerConsent(learner: Pick<Learner, "id" | "type" | "dateOfBirth" | "timeZone">, now = new Date()): Promise<LearnerConsent> {
  const needed = learner.type === "self_managed" && needsConsent(learner.dateOfBirth, todayIn(learner.timeZone, now));
  if (!needed) return { state: "not_needed", latest: null, practiseAllowed: true };
  const rows = await db.select().from(consentRequests).where(eq(consentRequests.studentId, learner.id)).orderBy(asc(consentRequests.createdAt));
  const latest = rows.at(-1) ?? null;
  const state = consentState(true, latest, rows[0] ?? null, now);
  return { state, latest, practiseAllowed: practiceAllowed(state) };
}

// ── The learner asks a parent (sm-1d, sm-1e) ───────────────────────────────

export type RequestResult = { ok: true; request: Request } | { ok: false; fieldErrors: Record<string, string> };

/**
 * Ask a parent to agree: ends any earlier open request, emails the parent a link (valid 7 days), schedules one
 * reminder and the 30-day check. The parent's email can't be the learner's own or another learner's account.
 */
export async function requestConsent(
  learner: Learner,
  input: { parentName: string; parentEmail: string },
  kind: "requested" | "email_changed" | "link_resent" = "requested",
  now = new Date(),
): Promise<RequestResult> {
  const parentName = input.parentName.trim();
  const parentEmail = normalizeEmail(input.parentEmail);
  const fieldErrors: Record<string, string> = {};
  const nameErr = validateName(parentName);
  const emailErr = validateEmail(parentEmail);
  if (nameErr) fieldErrors.parentName = nameErr;
  if (emailErr) fieldErrors.parentEmail = emailErr;
  else if (parentEmail === learner.email?.toLowerCase()) fieldErrors.parentEmail = "Use your parent's email, not your own.";
  else {
    // Block obvious self-consent: no learner account may consent (editions §2.4).
    const [other] = await db.select({ id: students.id }).from(students).where(eq(sql`lower(${students.email})`, parentEmail));
    if (other) fieldErrors.parentEmail = "That email belongs to a learner account. Use your parent's own email.";
  }
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };

  const isFirst = !(await db.select({ id: consentRequests.id }).from(consentRequests).where(eq(consentRequests.studentId, learner.id)).limit(1)).length;
  const request = await db.transaction(async (tx) => {
    await tx
      .update(consentRequests)
      .set({ status: "expired" })
      .where(and(eq(consentRequests.studentId, learner.id), eq(consentRequests.status, "pending")));
    const id = crypto.randomUUID();
    const [row] = await tx
      .insert(consentRequests)
      .values({ id, studentId: learner.id, parentName, parentEmail, tokenHash: sha256(tokenFor(id)), linkExpiresAt: linkExpiry(now), createdAt: now })
      .returning();
    return row!;
  });
  await logEvent(kind, request, { parentEmail }, now);
  await emailSender().send({ to: parentEmail, ...renderParentEmail(learner, request, false) });
  await enqueue("consent_reminder", { requestId: request.id }, { runAt: reminderAt(now) });
  if (isFirst) await enqueue("consent_overdue", { studentId: learner.id }, { runAt: overdueAt(now) });
  return { ok: true, request };
}

/** "Resend" on the banner: a new link to the same parent (rate-limited by the caller). */
export async function resendConsent(learner: Learner, now = new Date()): Promise<RequestResult | null> {
  const { latest } = await learnerConsent(learner, now);
  if (!latest || latest.status === "agreed" || latest.status === "declined") return null;
  return requestConsent(learner, { parentName: latest.parentName, parentEmail: latest.parentEmail }, "link_resent", now);
}

// ── The parent's page (sm-1f) ───────────────────────────────────────────────

export type OpenRequest = { request: Request; learner: Learner };

/** The open request behind a link, or null if the link is unknown, used up, replaced or expired. */
export async function openRequest(token: string, now = new Date()): Promise<OpenRequest | null> {
  const [id, sig] = token.split(".");
  if (!id || !sig || !/^[0-9a-f-]{36}$/i.test(id) || !safeEqual(tokenFor(id), token)) return null;
  const [row] = await db
    .select({ request: consentRequests, learner: students })
    .from(consentRequests)
    .innerJoin(students, eq(students.id, consentRequests.studentId))
    .where(and(eq(consentRequests.tokenHash, sha256(token)), eq(consentRequests.status, "pending"), gt(consentRequests.linkExpiresAt, now)));
  return row ?? null;
}

/** Send the parent a 6-digit code (when the page opens, and "Send a new code"). At most 5 an hour (rules §1). */
export async function sendParentCode(open: OpenRequest, now = new Date()): Promise<{ sent: boolean }> {
  const { request } = open;
  const [{ n } = { n: 0 }] = await db
    .select({ n: count() })
    .from(consentEvents)
    .where(and(eq(consentEvents.requestId, request.id), eq(consentEvents.kind, "code_sent"), gt(consentEvents.at, new Date(now.getTime() - 60 * 60_000))));
  if (!canSendCode(n)) return { sent: false };
  const code = generateCode(randomInt);
  await db
    .update(consentRequests)
    .set({ codeHash: hmac(code), codeExpiresAt: codeExpiry(now), codeTriesLeft: initialTries, codeUsedAt: null })
    .where(eq(consentRequests.id, request.id));
  await logEvent("code_sent", request, undefined, now);
  await emailSender().sendCode({
    to: request.parentEmail,
    parentName: request.parentName,
    purpose: "parent_consent",
    code,
    studentName: open.learner.name,
    ttlMinutes: rules.accounts.code.ttlMinutes,
  });
  return { sent: true };
}

export type AnswerResult =
  | { result: "agreed" | "declined" }
  | { result: "wrong"; triesLeft: number }
  | { result: "locked"; newCodeSent: boolean }
  | { result: "expired" | "no_code" | "malformed" | "invalid" };

/**
 * The parent's answer (I agree / Decline). Both need the right code: declining deletes the learner's account, so
 * it must come from the parent's inbox too. Agreeing also needs the consent box ticked (checked by the caller).
 */
export async function answerConsent(
  token: string,
  input: { code: string; agree: boolean; progressView: boolean },
  now = new Date(),
): Promise<AnswerResult> {
  const open = await openRequest(token, now);
  if (!open) return { result: "invalid" };
  const { request, learner } = open;
  const entered = normalizeCodeInput(input.code);
  if (!entered) return { result: "malformed" };
  if (!request.codeHash || !request.codeExpiresAt) return { result: "no_code" };

  const attempt = checkCodeAttempt(
    { expiresAt: request.codeExpiresAt, triesLeft: request.codeTriesLeft, usedAt: request.codeUsedAt, invalidatedAt: request.codeTriesLeft <= 0 ? request.codeExpiresAt : null },
    safeEqual(hmac(entered), request.codeHash),
    now,
  );
  if (attempt.result === "wrong" || attempt.result === "locked") {
    const triesLeft = request.codeTriesLeft - 1;
    await db.update(consentRequests).set({ codeTriesLeft: triesLeft }).where(eq(consentRequests.id, request.id));
    await logEvent("code_wrong", request, { triesLeft }, now);
    if (triesLeft > 0) return { result: "wrong", triesLeft };
    const sent = await sendParentCode(open, now);
    return { result: "locked", newCodeSent: sent.sent };
  }
  if (attempt.result !== "ok") return { result: attempt.result === "used" || attempt.result === "invalidated" ? "expired" : attempt.result };

  await db.update(consentRequests).set({ codeUsedAt: now }).where(eq(consentRequests.id, request.id));
  await logEvent("code_verified", request, undefined, now);

  if (input.agree) {
    await db
      .update(consentRequests)
      .set({ status: "agreed", verificationLevel: "email_code", progressView: input.progressView, policyVersion: POLICIES_VERSION, answeredAt: now })
      .where(eq(consentRequests.id, request.id));
    await logEvent("agreed", request, { parentEmail: request.parentEmail, verificationLevel: "email_code", progressView: input.progressView, policyVersion: POLICIES_VERSION }, now);
    if (learner.email) await emailSender().send({ to: learner.email, ...renderLearnerAgreedEmail(learner, request) });
    return { result: "agreed" };
  }

  await db.update(consentRequests).set({ status: "declined", answeredAt: now }).where(eq(consentRequests.id, request.id));
  await logEvent("declined", request, { parentEmail: request.parentEmail }, now);
  if (learner.email) await emailSender().send({ to: learner.email, ...renderLearnerDeclinedEmail(learner) });
  // Editions §2.4: declining closes the account and deletes its data. The audit events stay (learner id cleared).
  await deleteSelfManagedLearner(learner.id);
  return { result: "declined" };
}

// ── Jobs ────────────────────────────────────────────────────────────────────

/** One reminder to the parent, 3 days after the request, if it is still the open one and unanswered. */
export async function consentReminderJob(payload: unknown, now = new Date()) {
  const { requestId } = payload as { requestId: string };
  const [row] = await db
    .select({ request: consentRequests, learner: students })
    .from(consentRequests)
    .innerJoin(students, eq(students.id, consentRequests.studentId))
    .where(eq(consentRequests.id, requestId));
  if (!row || row.request.status !== "pending" || row.request.remindedAt || row.request.linkExpiresAt <= now) return;
  await db.update(consentRequests).set({ remindedAt: now }).where(eq(consentRequests.id, requestId));
  await logEvent("reminder_sent", row.request, undefined, now);
  await emailSender().send({ to: row.request.parentEmail, ...renderParentEmail(row.learner, row.request, true) });
}

/** 30 days after the first request: with no answer, practice pauses (the state becomes "overdue"); logged once. */
export async function consentOverdueJob(payload: unknown, now = new Date()) {
  const { studentId } = payload as { studentId: string };
  const [learner] = await db.select().from(students).where(eq(students.id, studentId));
  if (!learner) return;
  const { state, latest } = await learnerConsent(learner, now);
  if (state !== "overdue") return;
  await logEvent("paused_no_answer", { id: latest?.id ?? null, studentId }, undefined, now);
  if (learner.email) await emailSender().send({ to: learner.email, ...renderLearnerPausedEmail(learner) });
}

/** For tests and the owner: the audit trail of a request or a learner. */
export async function consentAudit(where: { requestId?: string; studentId?: string }) {
  const conds = [where.requestId ? eq(consentEvents.requestId, where.requestId) : undefined, where.studentId ? eq(consentEvents.studentId, where.studentId) : undefined].filter(Boolean);
  return db.select().from(consentEvents).where(and(...conds)).orderBy(asc(consentEvents.at), asc(consentEvents.kind));
}

/** Requests that are still waiting, newest first (for the learner's banner). */
export async function pendingRequests(studentIds: string[]) {
  if (!studentIds.length) return [];
  return db.select().from(consentRequests).where(and(inArray(consentRequests.studentId, studentIds), eq(consentRequests.status, "pending"))).orderBy(desc(consentRequests.createdAt));
}

// ── Emails ──────────────────────────────────────────────────────────────────

const formatDob = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`)) : "";

export function renderParentEmail(learner: Pick<Learner, "name" | "dateOfBirth">, request: Pick<Request, "id" | "parentName" | "linkExpiresAt">, reminder: boolean) {
  const days = Math.max(1, Math.round((request.linkExpiresAt.getTime() - Date.now()) / DAY));
  return {
    subject: reminder ? `Reminder: ${learner.name} is waiting for your consent on owlrnd` : `${learner.name} asked for your consent to use owlrnd`,
    text: [
      `Hi ${request.parentName},`,
      "",
      `${learner.name}${learner.dateOfBirth ? ` (born ${formatDob(learner.dateOfBirth)})` : ""} has signed up to owlrnd to practise for their exams. Because they are under 18, we need a parent or guardian to agree.`,
      "",
      "owlrnd writes short practice exams from the material the learner adds, marks them and builds the next exam from the result.",
      "What we keep: their name, email and date of birth; their tracks, answers and scores; material they upload.",
      "What we never do: show ads, sell or share their data, or track them outside owlrnd.",
      "You won't control their tracks or see their answers.",
      "",
      "Open this link to agree or decline. You'll confirm with a code sent to this email:",
      "",
      `    ${consentLink(request.id)}`,
      "",
      `The link works for ${days} ${days === 1 ? "day" : "days"}. If you decline, ${learner.name}'s account is closed and its data deleted.`,
      "If you don't know who this is, you can ignore this email.",
      "",
      "owlrnd",
    ].join("\n"),
  };
}

function renderLearnerAgreedEmail(learner: Pick<Learner, "name">, request: Pick<Request, "parentName">) {
  return {
    subject: "Your parent agreed: owlrnd is all set",
    text: [`Hi ${learner.name},`, "", `${request.parentName} agreed to you using owlrnd. Nothing else to do: keep practising.`, "", "owlrnd"].join("\n"),
  };
}

function renderLearnerDeclinedEmail(learner: Pick<Learner, "name">) {
  return {
    subject: "Your owlrnd account has been closed",
    text: [
      `Hi ${learner.name},`,
      "",
      "Your parent or guardian declined consent for you to use owlrnd, so your account has been closed and its data deleted.",
      "If this was a mistake, ask them to set owlrnd up for you, or sign up again with them.",
      "",
      "owlrnd",
    ].join("\n"),
  };
}

function renderLearnerPausedEmail(learner: Pick<Learner, "name">) {
  return {
    subject: "owlrnd: practice is paused until your parent agrees",
    text: [
      `Hi ${learner.name},`,
      "",
      `Your parent hasn't answered in ${rules.consent.pauseAfterDays} days, so practice is paused. Sign in and send them a new link; you can carry on as soon as they agree.`,
      "",
      "owlrnd",
    ].join("\n"),
  };
}

export const maskedParentEmail = (r: Pick<Request, "parentEmail">) => maskEmail(r.parentEmail);
