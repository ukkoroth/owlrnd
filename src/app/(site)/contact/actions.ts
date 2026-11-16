"use server";

import { redirect } from "next/navigation";
import { normalizeEmail, validateEmail, validateName } from "@/domain/identity";
import { text, type FormState } from "@/lib/form";
import { requestPackage } from "@/server/packageRequests";
import { allowed, RATE_LIMITED } from "@/server/rateLimit";

const MESSAGE_MAX = 2000;

/** "Contact us to buy a package" (0.2 plan, M7): emails the owner. Nothing is stored. */
export async function sendPackageRequest(_prev: FormState, form: FormData): Promise<FormState> {
  const name = text(form, "name").trim();
  const email = normalizeEmail(text(form, "email"));
  const message = text(form, "message").trim();
  const values = { name, email: text(form, "email"), message };

  // Hidden field that people never see or fill in; automated form fillers often do.
  if (text(form, "website")) redirect("/contact?topic=package&sent=1");
  if (!(await allowed("contact"))) return { error: RATE_LIMITED, values };

  const fieldErrors: Record<string, string> = {};
  const nameErr = validateName(name);
  const emailErr = validateEmail(email);
  if (nameErr) fieldErrors.name = nameErr;
  if (emailErr) fieldErrors.email = emailErr;
  if (!message) fieldErrors.message = "Write a short message.";
  else if (message.length > MESSAGE_MAX) fieldErrors.message = `Keep it under ${MESSAGE_MAX} characters.`;
  if (Object.keys(fieldErrors).length) return { fieldErrors, values };

  const sent = await requestPackage({ name, email, message });
  if (!sent) return { error: "We couldn't send your message just now. Please email us instead.", values };
  redirect("/contact?topic=package&sent=1");
}
