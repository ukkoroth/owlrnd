"use server";

import { redirect } from "next/navigation";
import { POLICIES_VERSION } from "@/config/legal";
import { rules } from "@/config/rules";
import { parseDateOfBirth, parseIdentifier, normalizeEmail, validateEmail, validateName, validatePassword } from "@/domain/identity";
import { todayIn } from "@/domain/tracks";
import { codeFrom, text, type FormState } from "@/lib/form";
import {
  codeOwnerOf,
  findAccount,
  getParent,
  markEmailVerified,
  markLearnerEmailVerified,
  recordSignInFailure,
  tooManySignInFailures,
  upsertUnverifiedLearner,
  upsertUnverifiedParent,
} from "@/server/auth/accounts";
import { issueCode, verifyCode, type CodeOwner, type IssueResult } from "@/server/auth/codes";
import { clearPending, clientIp, getPending, setPending, startSession } from "@/server/auth/current";
import { hashPassword, verifyDummyPassword, verifyPassword } from "@/server/auth/passwords";
import { revokeAllSessions, type SessionOwner } from "@/server/auth/sessions";
import { db } from "@/server/db";
import { parents, students } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { codeMessage, sendLimitMessage } from "@/lib/codeMessages";
import { allowed, RATE_LIMITED } from "@/server/rateLimit";
import { checkInvitation, claimInvitation, hasOpenClaim, consumeInvitation } from "@/server/access";

const INVITE_NEEDED = "This invitation link has expired or has already been used. Ask for access again and we'll send you a new one.";

const BAD_SIGN_IN = "That email or username and password don't match.";

// ── 3a Sign in ──────────────────────────────────────────────────────────────

export async function signIn(_prev: FormState, form: FormData): Promise<FormState> {
  if (!(await allowed("signIn"))) return { error: RATE_LIMITED, values: { identifier: text(form, "identifier") } };
  const rawId = text(form, "identifier");
  const password = text(form, "password");
  const values = { identifier: rawId };
  const id = parseIdentifier(rawId);
  if (!id || !password) return { error: "Enter your email or username and your password.", values };

  if (await tooManySignInFailures(id.value)) {
    return { error: `Too many attempts. Wait ${rules.accounts.signInFailures.windowMinutes} minutes and try again, or reset your password.`, values };
  }

  const account = await findAccount(id);
  const ok = account
    ? await verifyPassword(account.kind === "parent" ? account.parent.passwordHash : account.student.passwordHash, password)
    : await verifyDummyPassword(password);
  if (!account || !ok) {
    await recordSignInFailure(id.value, await clientIp());
    return { error: BAD_SIGN_IN, values };
  }

  // A parent who never confirmed their email goes back to 1b (rules §1: unusable until verified).
  if (account.kind === "parent" && !account.parent.emailVerifiedAt) {
    await setPending({ kind: "verify_email", parentId: account.parent.id, studentId: null });
    await issueCode({ parentId: account.parent.id, studentId: null, purpose: "verify_email" });
    redirect("/sign-up/verify");
  }
  // The same for a self-managed learner (sm-1c).
  if (account.kind === "student" && account.student.type === "self_managed" && !account.student.emailVerifiedAt) {
    await setPending({ kind: "verify_email", parentId: null, studentId: account.student.id });
    await issueCode({ parentId: null, studentId: account.student.id, purpose: "verify_email" });
    redirect("/sign-up/verify");
  }

  const owner: CodeOwner = { ...codeOwnerOf(account), purpose: "sign_in" };
  await setPending({ kind: "sign_in", parentId: owner.parentId, studentId: owner.studentId });
  const sent = await issueCode(owner);
  redirect(sent.sent ? "/sign-in/code" : "/sign-in/code?limit=1");
}

// ── 3b / 5f Sign-in code ────────────────────────────────────────────────────

export async function verifySignInCode(_prev: FormState, form: FormData): Promise<FormState> {
  if (!(await allowed("codeEntry"))) return { error: RATE_LIMITED };
  const pending = await getPending("sign_in");
  if (!pending) redirect("/sign-in?expired=1");
  const result = await verifyCode({ parentId: pending.parentId, studentId: pending.studentId, purpose: "sign_in" }, codeFrom(form));
  if (result.result !== "ok") return codeMessage(result);

  await clearPending();
  await startSession(sessionOwnerOf(pending));
  redirect(pending.studentId ? "/today" : "/students");
}

export async function resendSignInCode(): Promise<FormState> {
  if (!(await allowed("codeSend"))) return { error: RATE_LIMITED };
  const pending = await getPending("sign_in");
  if (!pending) redirect("/sign-in?expired=1");
  return resendResult(await issueCode({ parentId: pending.parentId, studentId: pending.studentId, purpose: "sign_in" }));
}

// ── 1a Sign up, 1b Verify email ─────────────────────────────────────────────

export async function signUp(_prev: FormState, form: FormData): Promise<FormState> {
  if (!(await allowed("signUp"))) return { error: RATE_LIMITED };
  const name = text(form, "name").trim();
  const email = normalizeEmail(text(form, "email"));
  const password = text(form, "password");
  const timeZone = validTimeZone(text(form, "timeZone"));
  const values = { name, email: text(form, "email") };

  const fieldErrors: Record<string, string> = {};
  const nameErr = validateName(name);
  const emailErr = validateEmail(email);
  const pwErr = validatePassword(password);
  if (nameErr) fieldErrors.name = nameErr;
  if (emailErr) fieldErrors.email = emailErr;
  if (pwErr) fieldErrors.password = pwErr;
  // Consent (release plan, Phase 1 item 7): required, and recorded with the policy version on the account.
  if (text(form, "consent") !== "yes") fieldErrors.consent = "Please confirm you are the parent or guardian and agree to the terms and privacy policy.";
  if (Object.keys(fieldErrors).length) return { fieldErrors, values };

  const pending = await getPending("verify_email");

  // Closed beta: a valid invitation link, or (for "Use a different email") the one this account was started with.
  let invitationId: string | null = null;
  if (rules.access.inviteOnly && !(pending?.parentId && (await hasOpenClaim({ parentId: pending.parentId })))) {
    const invitation = await checkInvitation(text(form, "invite"));
    if (!invitation.ok) return { error: INVITE_NEEDED, values };
    invitationId = invitation.id;
  }

  const res = await upsertUnverifiedParent(
    { name, email, passwordHash: await hashPassword(password), timeZone, consentedAt: new Date(), consentVersion: POLICIES_VERSION },
    pending?.parentId ?? null,
  );
  if (!res.ok) return { fieldErrors: { email: "An account with this email already exists. Sign in instead." }, values };
  if (invitationId) await claimInvitation(invitationId, { parentId: res.parentId });

  await setPending({ kind: "verify_email", parentId: res.parentId, studentId: null });
  const sent = await issueCode({ parentId: res.parentId, studentId: null, purpose: "verify_email" });
  redirect(sent.sent ? "/sign-up/verify" : "/sign-up/verify?limit=1");
}

// ── sm-1b Sign up "For me" ──────────────────────────────────────────────────

export async function signUpLearner(_prev: FormState, form: FormData): Promise<FormState> {
  if (!(await allowed("signUp"))) return { error: RATE_LIMITED };
  const name = text(form, "name").trim();
  const email = normalizeEmail(text(form, "email"));
  const password = text(form, "password");
  const timeZone = validTimeZone(text(form, "timeZone"));
  const dob = { day: text(form, "dobDay"), month: text(form, "dobMonth"), year: text(form, "dobYear") };
  const values = { name, email: text(form, "email"), dobDay: dob.day, dobMonth: dob.month, dobYear: dob.year };

  const fieldErrors: Record<string, string> = {};
  const nameErr = validateName(name);
  const emailErr = validateEmail(email);
  const pwErr = validatePassword(password);
  const birth = parseDateOfBirth(dob, todayIn(timeZone), rules.accounts.ages.learner);
  if (nameErr) fieldErrors.name = nameErr;
  if (emailErr) fieldErrors.email = emailErr;
  if (pwErr) fieldErrors.password = pwErr;
  if (!birth.ok) fieldErrors.dob = birth.error;
  if (text(form, "consent") !== "yes") fieldErrors.consent = "Please agree to the terms and privacy policy to create your account.";
  if (Object.keys(fieldErrors).length || !birth.ok) return { fieldErrors, values };

  // Editions §2.4: an under-18 learner needs a parent's consent, which arrives in M10. Until then, no account.
  if (birth.age < rules.accounts.ages.adult && !rules.accounts.ages.under18SelfSignUp) redirect("/sign-up?for=me&under18=1");

  const pending = await getPending("verify_email");
  const pendingStudentId = pending && !pending.parentId ? pending.studentId : null;

  let invitationId: string | null = null;
  if (rules.access.inviteOnly && !(pendingStudentId && (await hasOpenClaim({ studentId: pendingStudentId })))) {
    const invitation = await checkInvitation(text(form, "invite"));
    if (!invitation.ok) return { error: INVITE_NEEDED, values };
    invitationId = invitation.id;
  }

  const res = await upsertUnverifiedLearner(
    { name, email, passwordHash: await hashPassword(password), timeZone, dateOfBirth: birth.iso, consentedAt: new Date(), consentVersion: POLICIES_VERSION },
    pendingStudentId,
  );
  if (!res.ok) return { fieldErrors: { email: "An account with this email already exists. Sign in instead." }, values };
  if (invitationId) await claimInvitation(invitationId, { studentId: res.studentId });

  await setPending({ kind: "verify_email", parentId: null, studentId: res.studentId });
  const sent = await issueCode({ parentId: null, studentId: res.studentId, purpose: "verify_email" });
  redirect(sent.sent ? "/sign-up/verify" : "/sign-up/verify?limit=1");
}

export async function verifyEmail(_prev: FormState, form: FormData): Promise<FormState> {
  if (!(await allowed("codeEntry"))) return { error: RATE_LIMITED };
  const pending = await getPending("verify_email");
  if (!pending) redirect("/sign-in?expired=1");
  const result = await verifyCode({ parentId: pending.parentId, studentId: pending.studentId, purpose: "verify_email" }, codeFrom(form));
  if (result.result !== "ok") return codeMessage(result);

  // A self-managed learner (sm-1c) goes on to choose their exam or build a track (sm-2a).
  if (pending.studentId) {
    await markLearnerEmailVerified(pending.studentId);
    await consumeInvitation({ studentId: pending.studentId });
    await clearPending();
    await startSession({ studentId: pending.studentId });
    redirect("/tracks/setup");
  }
  if (!pending.parentId) redirect("/sign-in?expired=1");

  await markEmailVerified(pending.parentId);
  await consumeInvitation({ parentId: pending.parentId });
  await clearPending();
  await startSession({ parentId: pending.parentId });
  redirect("/students/new"); // flow 1: a new parent goes straight to 2a Add a student
}

export async function resendVerifyCode(): Promise<FormState> {
  if (!(await allowed("codeSend"))) return { error: RATE_LIMITED };
  const pending = await getPending("verify_email");
  if (!pending) redirect("/sign-in?expired=1");
  return resendResult(await issueCode({ parentId: pending.parentId, studentId: pending.studentId, purpose: "verify_email" }));
}

// ── 5g Forgot password, 5h Reset password ──────────────────────────────────

export async function forgotPassword(_prev: FormState, form: FormData): Promise<FormState> {
  if (!(await allowed("passwordReset"))) return { error: RATE_LIMITED, values: { identifier: text(form, "identifier") } };
  const rawId = text(form, "identifier");
  const id = parseIdentifier(rawId);
  if (!id) return { error: "Enter your email or username.", values: { identifier: rawId } };

  const account = await findAccount(id);
  // Owner decision (M1): say plainly when the account doesn't exist.
  if (!account) return { error: "We couldn't find that email or username.", values: { identifier: rawId } };

  const owner: CodeOwner = { ...codeOwnerOf(account), purpose: "reset_password" };
  await setPending({ kind: "reset_password", parentId: owner.parentId, studentId: owner.studentId });
  const sent = await issueCode(owner);
  redirect(sent.sent ? "/reset-password" : "/reset-password?limit=1");
}

export async function resetPassword(_prev: FormState, form: FormData): Promise<FormState> {
  if (!(await allowed("codeEntry"))) return { error: RATE_LIMITED };
  const pending = await getPending("reset_password");
  if (!pending) redirect("/forgot-password?expired=1");

  // Check the new password first, so a typo doesn't use up a code try.
  const password = text(form, "password");
  const confirm = text(form, "confirm");
  const pwErr = validatePassword(password);
  if (pwErr) return { fieldErrors: { password: pwErr } };
  if (password !== confirm) return { fieldErrors: { confirm: "The two passwords don't match." } };

  const result = await verifyCode({ parentId: pending.parentId, studentId: pending.studentId, purpose: "reset_password" }, codeFrom(form));
  if (result.result !== "ok") return codeMessage(result);

  const passwordHash = await hashPassword(password);
  if (pending.studentId) {
    await db.update(students).set({ passwordHash }).where(eq(students.id, pending.studentId));
    await revokeAllSessions({ studentId: pending.studentId });
  } else if (pending.parentId) {
    // The code reached the parent's inbox, which also proves the email address.
    const parent = await getParent(pending.parentId);
    await db
      .update(parents)
      .set({ passwordHash, emailVerifiedAt: parent?.emailVerifiedAt ?? new Date() })
      .where(eq(parents.id, pending.parentId));
    await revokeAllSessions({ parentId: pending.parentId });
  }

  await clearPending();
  await startSession(sessionOwnerOf(pending));
  redirect(pending.studentId ? "/today" : "/students");
}

export async function resendResetCode(): Promise<FormState> {
  if (!(await allowed("codeSend"))) return { error: RATE_LIMITED };
  const pending = await getPending("reset_password");
  if (!pending) redirect("/forgot-password?expired=1");
  return resendResult(await issueCode({ parentId: pending.parentId, studentId: pending.studentId, purpose: "reset_password" }));
}

// ── helpers ────────────────────────────────────────────────────────────────

/** A student's session is theirs (parent-managed or self-managed); otherwise the parent's. */
function sessionOwnerOf(p: { parentId: string | null; studentId: string | null }): SessionOwner {
  if (p.studentId) return { studentId: p.studentId };
  if (!p.parentId) throw new Error("sessionOwnerOf: no owner");
  return { parentId: p.parentId };
}

function resendResult(sent: IssueResult): FormState {
  return sent.sent ? { notice: "We sent a new code. Use the code in the latest email." } : { error: sendLimitMessage };
}

function validTimeZone(tz: string): string {
  try {
    if (tz) {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      return tz;
    }
  } catch {}
  return "UTC";
}

