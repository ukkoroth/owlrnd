"use server";

import { redirect } from "next/navigation";
import { normalizeEmail, validateEmail, validateName } from "@/domain/identity";
import { text, type FormState } from "@/lib/form";
import { recordAccessRequest } from "@/server/access";
import { allowed, RATE_LIMITED } from "@/server/rateLimit";

const NOTE_MAX = 1000;

/** Get access (closed beta): records the request; the owner sends invitations with `npm run invite`. */
export async function requestAccess(_prev: FormState, form: FormData): Promise<FormState> {
  const name = text(form, "name").trim();
  const email = normalizeEmail(text(form, "email"));
  const note = text(form, "note").trim();
  const values = { name, email: text(form, "email"), note };

  // Hidden field that people never see or fill in; automated form fillers often do.
  if (text(form, "website")) redirect("/get-access?sent=1");
  if (!(await allowed("getAccess"))) return { error: RATE_LIMITED, values };

  const fieldErrors: Record<string, string> = {};
  const nameErr = validateName(name);
  const emailErr = validateEmail(email);
  if (nameErr) fieldErrors.name = nameErr;
  if (emailErr) fieldErrors.email = emailErr;
  if (note.length > NOTE_MAX) fieldErrors.note = `Keep it under ${NOTE_MAX} characters.`;
  if (Object.keys(fieldErrors).length) return { fieldErrors, values };

  await recordAccessRequest({ name, email, note: note || null });
  redirect("/get-access?sent=1");
}
