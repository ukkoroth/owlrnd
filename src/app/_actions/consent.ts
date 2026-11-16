"use server";

import { redirect } from "next/navigation";
import { codeFrom, text, type FormState } from "@/lib/form";
import { codeMessage, sendLimitMessage } from "@/lib/codeMessages";
import { requireShell } from "@/server/auth/current";
import * as consent from "@/server/consent";
import { allowed, RATE_LIMITED } from "@/server/rateLimit";

// Parent consent for an under-18 learner (editions §2.4, M10): the learner's side (sm-1d, sm-1e) and the
// parent's page (sm-1f), which needs no account, only the link and a code sent to the parent's email.

/** sm-1d "Send and continue" (also Change email from the banner). */
export async function askParent(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireShell("learner");
  if (!(await allowed("codeSend"))) return { error: RATE_LIMITED };
  const values = { parentName: text(form, "parentName"), parentEmail: text(form, "parentEmail") };
  const { state, latest } = await consent.learnerConsent(user.student);
  if (state === "not_needed" || state === "agreed") redirect("/today");
  const res = await consent.requestConsent(user.student, values, latest ? "email_changed" : "requested");
  if (!res.ok) return { fieldErrors: res.fieldErrors, values };
  redirect(latest ? "/today?consent=sent" : "/tracks/setup");
}

/** Banner: "Resend" a new link to the same parent. */
export async function resendToParent(): Promise<void> {
  const { user } = await requireShell("learner");
  if (!(await allowed("codeSend"))) redirect("/today?consent=limit");
  const res = await consent.resendConsent(user.student);
  redirect(res?.ok ? "/today?consent=sent" : "/consent/parent");
}

/** sm-1f: "Send a new code" to the parent's email. */
export async function sendParentCode(token: string): Promise<FormState> {
  if (!(await allowed("codeSend"))) return { error: RATE_LIMITED };
  const open = await consent.openRequest(token);
  if (!open) redirect(`/consent/${encodeURIComponent(token)}`);
  const sent = await consent.sendParentCode(open);
  return sent.sent ? { notice: "We sent a new code. Use the code in the latest email." } : { error: sendLimitMessage };
}

/** sm-1f: I agree / Decline. Both need the code; agreeing also needs the consent box. */
export async function answerParent(token: string, _prev: FormState, form: FormData): Promise<FormState> {
  if (!(await allowed("codeEntry"))) return { error: RATE_LIMITED };
  const agree = text(form, "answer") === "agree";
  if (agree && text(form, "consent") !== "yes") {
    return { fieldErrors: { consent: "Tick the box to confirm you are the parent or guardian and agree." } };
  }
  const res = await consent.answerConsent(token, { code: codeFrom(form), agree, progressView: text(form, "progressView") === "yes" });
  switch (res.result) {
    case "agreed":
    case "declined":
      redirect(`/consent/done?answer=${res.result}`);
    case "invalid":
      redirect(`/consent/${encodeURIComponent(token)}`);
    case "wrong":
      return codeMessage({ result: "wrong", triesLeft: res.triesLeft });
    case "locked":
      return codeMessage({ result: "locked", newCodeSent: res.newCodeSent });
    default:
      return codeMessage({ result: res.result === "no_code" ? "no_code" : res.result });
  }
}
