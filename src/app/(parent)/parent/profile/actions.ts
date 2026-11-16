"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { normalizeEmail, validateEmail, validateName, validatePassword } from "@/domain/identity";
import { codeFrom, text, type FormState } from "@/lib/form";
import { changeParentEmail, deleteParent, emailTakenByVerified } from "@/server/auth/accounts";
import { issueCode, pendingNewEmail, verifyCode } from "@/server/auth/codes";
import { requireShell, SESSION_COOKIE } from "@/server/auth/current";
import { hashPassword, verifyPassword } from "@/server/auth/passwords";
import { revokeAllSessions } from "@/server/auth/sessions";
import { db } from "@/server/db";
import { parents } from "@/server/db/schema";
import { codeMessage, sendLimitMessage } from "@/lib/codeMessages";

export async function updateName(_prev: FormState, form: FormData): Promise<FormState> {
  const { user: { parent } } = await requireShell("parent");
  const name = text(form, "name").trim();
  const err = validateName(name);
  if (err) return { fieldErrors: { name: err }, values: { name } };
  await db.update(parents).set({ name }).where(eq(parents.id, parent.id));
  redirect("/parent/profile?updated=name");
}

// Rules §1: changing the email needs a code sent to the new address before it takes effect.
export async function startEmailChange(_prev: FormState, form: FormData): Promise<FormState> {
  const { user: { parent } } = await requireShell("parent");
  const raw = text(form, "email");
  const email = normalizeEmail(raw);
  const err = validateEmail(email);
  if (err) return { fieldErrors: { email: err }, values: { email: raw } };
  if (email === parent.email.toLowerCase()) return { fieldErrors: { email: "That is already your email." }, values: { email: raw } };
  if (await emailTakenByVerified(email, parent.id)) {
    return { fieldErrors: { email: "Another account already uses this email." }, values: { email: raw } };
  }
  const sent = await issueCode({ parentId: parent.id, studentId: null, purpose: "change_email", newEmail: email });
  if (!sent.sent) return { error: sendLimitMessage, values: { email: raw } };
  redirect("/parent/profile/email/verify");
}

export async function verifyEmailChange(_prev: FormState, form: FormData): Promise<FormState> {
  const { user: { parent } } = await requireShell("parent");
  const result = await verifyCode({ parentId: parent.id, studentId: null, purpose: "change_email" }, codeFrom(form));
  if (result.result !== "ok") return codeMessage(result);
  if (!result.newEmail || !(await changeParentEmail(parent.id, result.newEmail))) {
    return { error: "Another account started using that email. Choose a different one." };
  }
  redirect("/parent/profile?updated=email");
}

export async function resendEmailChange(): Promise<FormState> {
  const { user: { parent } } = await requireShell("parent");
  const newEmail = await pendingNewEmail({ parentId: parent.id, studentId: null });
  if (!newEmail) redirect("/parent/profile/email");
  const sent = await issueCode({ parentId: parent.id, studentId: null, purpose: "change_email", newEmail });
  return sent.sent ? { notice: "We sent a new code. Use the code in the latest email." } : { error: sendLimitMessage };
}

export async function changePassword(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireShell("parent");
  const current = text(form, "current");
  const password = text(form, "password");
  const confirm = text(form, "confirm");
  if (!(await verifyPassword(user.parent.passwordHash, current))) return { fieldErrors: { current: "That isn't your current password." } };
  const err = validatePassword(password);
  if (err) return { fieldErrors: { password: err } };
  if (password !== confirm) return { fieldErrors: { confirm: "The two passwords don't match." } };
  await db.update(parents).set({ passwordHash: await hashPassword(password) }).where(eq(parents.id, user.parent.id));
  // Other devices must sign in again; this one stays signed in.
  await revokeAllSessions({ parentId: user.parent.id }, user.sessionId);
  redirect("/parent/profile?updated=password");
}

export async function deleteAccount(_prev: FormState, form: FormData): Promise<FormState> {
  const { user: { parent } } = await requireShell("parent");
  if (!(await verifyPassword(parent.passwordHash, text(form, "password")))) {
    return { fieldErrors: { password: "That isn't your password." } };
  }
  await deleteParent(parent.id); // cascades to students, codes and sessions
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/sign-in?deleted=1");
}
