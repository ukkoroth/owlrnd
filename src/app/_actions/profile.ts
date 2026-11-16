"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { normalizeEmail, validateEmail, validateName, validatePassword } from "@/domain/identity";
import type { Actor } from "@/domain/permissions";
import { codeFrom, text, type FormState } from "@/lib/form";
import { changeAccountEmail, deleteOwnAccount, emailInUseByOther, ownAccount, renameAccount, setAccountPassword } from "@/server/auth/accounts";
import { issueCode, pendingNewEmail, verifyCode } from "@/server/auth/codes";
import { requireActor, SESSION_COOKIE } from "@/server/auth/current";
import { hashPassword, verifyPassword } from "@/server/auth/passwords";
import { revokeAllSessions } from "@/server/auth/sessions";
import { codeMessage, sendLimitMessage } from "@/lib/codeMessages";

// The account holder's own profile (0.2 plan, M9): a parent's (5d) or a self-managed learner's (sm-5b). A
// parent-managed learner holds no account of their own (§2.3), so every action here refuses them.

/** Where each kind of account's profile lives. */
const profilePath = (actor: Actor) => (actor.kind === "parent" ? "/parent/profile" : "/profile");

async function requireOwnAccount() {
  const { user, actor } = await requireActor();
  const account = await ownAccount(actor);
  if (!account) redirect("/profile");
  return { user, actor, account, base: profilePath(actor) };
}

export async function updateName(_prev: FormState, form: FormData): Promise<FormState> {
  const { account, base } = await requireOwnAccount();
  const name = text(form, "name").trim();
  const err = validateName(name);
  if (err) return { fieldErrors: { name: err }, values: { name } };
  await renameAccount(account, name);
  redirect(`${base}?updated=name`);
}

// Rules §1: changing the email needs a code sent to the new address before it takes effect.
export async function startEmailChange(_prev: FormState, form: FormData): Promise<FormState> {
  const { account, base } = await requireOwnAccount();
  const raw = text(form, "email");
  const email = normalizeEmail(raw);
  const err = validateEmail(email);
  if (err) return { fieldErrors: { email: err }, values: { email: raw } };
  if (email === account.email.toLowerCase()) return { fieldErrors: { email: "That is already your email." }, values: { email: raw } };
  if (await emailInUseByOther(account, email)) return { fieldErrors: { email: "Another account already uses this email." }, values: { email: raw } };
  const sent = await issueCode({ ...account.codeOwner, purpose: "change_email", newEmail: email });
  if (!sent.sent) return { error: sendLimitMessage, values: { email: raw } };
  redirect(`${base}/email/verify`);
}

export async function verifyEmailChange(_prev: FormState, form: FormData): Promise<FormState> {
  const { account, base } = await requireOwnAccount();
  const result = await verifyCode({ ...account.codeOwner, purpose: "change_email" }, codeFrom(form));
  if (result.result !== "ok") return codeMessage(result);
  if (!result.newEmail || !(await changeAccountEmail(account, result.newEmail))) {
    return { error: "Another account started using that email. Choose a different one." };
  }
  redirect(`${base}?updated=email`);
}

export async function resendEmailChange(): Promise<FormState> {
  const { account, base } = await requireOwnAccount();
  const newEmail = await pendingNewEmail(account.codeOwner);
  if (!newEmail) redirect(`${base}/email`);
  const sent = await issueCode({ ...account.codeOwner, purpose: "change_email", newEmail });
  return sent.sent ? { notice: "We sent a new code. Use the code in the latest email." } : { error: sendLimitMessage };
}

export async function changePassword(_prev: FormState, form: FormData): Promise<FormState> {
  const { user, account, base } = await requireOwnAccount();
  const current = text(form, "current");
  const password = text(form, "password");
  const confirm = text(form, "confirm");
  if (!(await verifyPassword(account.passwordHash, current))) return { fieldErrors: { current: "That isn't your current password." } };
  const err = validatePassword(password);
  if (err) return { fieldErrors: { password: err } };
  if (password !== confirm) return { fieldErrors: { confirm: "The two passwords don't match." } };
  await setAccountPassword(account, await hashPassword(password));
  // Other devices must sign in again; this one stays signed in.
  await revokeAllSessions(account.kind === "parent" ? { parentId: account.id } : { studentId: account.id }, user.sessionId);
  redirect(`${base}?updated=password`);
}

export async function deleteAccount(_prev: FormState, form: FormData): Promise<FormState> {
  const { actor, account } = await requireOwnAccount();
  if (!(await verifyPassword(account.passwordHash, text(form, "password")))) {
    return { fieldErrors: { password: "That isn't your password." } };
  }
  if (!(await deleteOwnAccount(actor, account))) return { error: "This account can't be deleted from here." };
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/sign-in?deleted=1");
}
