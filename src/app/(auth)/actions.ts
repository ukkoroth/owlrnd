"use server";

import { redirect } from "next/navigation";
import { rules } from "@/config/rules";
import { parseIdentifier, normalizeEmail, validateEmail, validateName, validatePassword } from "@/domain/identity";
import { codeFrom, text, type FormState } from "@/lib/form";
import { findAccount, getParent, markEmailVerified, recordSignInFailure, tooManySignInFailures, upsertUnverifiedParent } from "@/server/auth/accounts";
import { issueCode, verifyCode, type CodeOwner, type IssueResult } from "@/server/auth/codes";
import { clearPending, clientIp, getPending, setPending, startSession } from "@/server/auth/current";
import { hashPassword, verifyDummyPassword, verifyPassword } from "@/server/auth/passwords";
import { revokeAllSessions } from "@/server/auth/sessions";
import { db } from "@/server/db";
import { parents, students } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { codeMessage, sendLimitMessage } from "@/lib/codeMessages";
import { allowed, RATE_LIMITED } from "@/server/rateLimit";
import { checkInvitation, claimInvitation, hasOpenClaim, consumeInvitation } from "@/server/access";

const INVITE_NEEDED = "This invitation link has expired or has already been used. Ask for access again and we'll send you a new one.";

const BAD_SIGN_IN = "That username or email and password don't match.";

// ── 3a Sign in ──────────────────────────────────────────────────────────────

export async function signIn(_prev: FormState, form: FormData): Promise<FormState> {
  if (!(await allowed("signIn"))) return { error: RATE_LIMITED, values: { identifier: text(form, "identifier") } };
  const rawId = text(form, "identifier");
  const password = text(form, "password");
  const values = { identifier: rawId };
  const id = parseIdentifier(rawId);
  if (!id || !password) return { error: "Enter your username or email and your password.", values };

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

  const owner: CodeOwner = {
    parentId: account.parent.id,
    studentId: account.kind === "student" ? account.student.id : null,
    purpose: "sign_in",
  };
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
  await startSession(pending.studentId ? { studentId: pending.studentId } : { parentId: pending.parentId });
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
  if (Object.keys(fieldErrors).length) return { fieldErrors, values };

  const pending = await getPending("verify_email");

  // Closed beta: a valid invitation link, or (for "Use a different email") the one this account was started with.
  let invitationId: string | null = null;
  if (rules.access.inviteOnly && !(pending && (await hasOpenClaim(pending.parentId)))) {
    const invitation = await checkInvitation(text(form, "invite"));
    if (!invitation.ok) return { error: INVITE_NEEDED, values };
    invitationId = invitation.id;
  }

  const res = await upsertUnverifiedParent({ name, email, passwordHash: await hashPassword(password), timeZone }, pending?.parentId ?? null);
  if (!res.ok) return { fieldErrors: { email: "An account with this email already exists. Sign in instead." }, values };
  if (invitationId) await claimInvitation(invitationId, res.parentId);

  await setPending({ kind: "verify_email", parentId: res.parentId, studentId: null });
  const sent = await issueCode({ parentId: res.parentId, studentId: null, purpose: "verify_email" });
  redirect(sent.sent ? "/sign-up/verify" : "/sign-up/verify?limit=1");
}

export async function verifyEmail(_prev: FormState, form: FormData): Promise<FormState> {
  if (!(await allowed("codeEntry"))) return { error: RATE_LIMITED };
  const pending = await getPending("verify_email");
  if (!pending) redirect("/sign-in?expired=1");
  const result = await verifyCode({ parentId: pending.parentId, studentId: null, purpose: "verify_email" }, codeFrom(form));
  if (result.result !== "ok") return codeMessage(result);

  await markEmailVerified(pending.parentId);
  await consumeInvitation(pending.parentId);
  await clearPending();
  await startSession({ parentId: pending.parentId });
  redirect("/students/new"); // flow 1: a new parent goes straight to 2a Add a student
}

export async function resendVerifyCode(): Promise<FormState> {
  if (!(await allowed("codeSend"))) return { error: RATE_LIMITED };
  const pending = await getPending("verify_email");
  if (!pending) redirect("/sign-in?expired=1");
  return resendResult(await issueCode({ parentId: pending.parentId, studentId: null, purpose: "verify_email" }));
}

// ── 5g Forgot password, 5h Reset password ──────────────────────────────────

export async function forgotPassword(_prev: FormState, form: FormData): Promise<FormState> {
  if (!(await allowed("passwordReset"))) return { error: RATE_LIMITED, values: { identifier: text(form, "identifier") } };
  const rawId = text(form, "identifier");
  const id = parseIdentifier(rawId);
  if (!id) return { error: "Enter your username or email.", values: { identifier: rawId } };

  const account = await findAccount(id);
  // Owner decision (M1): say plainly when the account doesn't exist.
  if (!account) return { error: "We couldn't find that username or email.", values: { identifier: rawId } };

  const owner: CodeOwner = {
    parentId: account.parent.id,
    studentId: account.kind === "student" ? account.student.id : null,
    purpose: "reset_password",
  };
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
  } else {
    // The code reached the parent's inbox, which also proves the email address.
    const parent = await getParent(pending.parentId);
    await db
      .update(parents)
      .set({ passwordHash, emailVerifiedAt: parent?.emailVerifiedAt ?? new Date() })
      .where(eq(parents.id, pending.parentId));
    await revokeAllSessions({ parentId: pending.parentId });
  }

  await clearPending();
  await startSession(pending.studentId ? { studentId: pending.studentId } : { parentId: pending.parentId });
  redirect(pending.studentId ? "/today" : "/students");
}

export async function resendResetCode(): Promise<FormState> {
  if (!(await allowed("codeSend"))) return { error: RATE_LIMITED };
  const pending = await getPending("reset_password");
  if (!pending) redirect("/forgot-password?expired=1");
  return resendResult(await issueCode({ parentId: pending.parentId, studentId: pending.studentId, purpose: "reset_password" }));
}

// ── helpers ────────────────────────────────────────────────────────────────

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

