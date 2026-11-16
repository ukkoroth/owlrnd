"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formatClass, validateClassName, validateName, validatePassword, validateUsername } from "@/domain/identity";
import { text, type FormState } from "@/lib/form";
import { requireShell } from "@/server/auth/current";
import * as students from "@/server/students";

const TAKEN = "That username is taken. Try adding a number, like scout.f2.";

function readDetails(form: FormData) {
  const values = { name: text(form, "name").trim(), className: text(form, "className").trim(), username: text(form, "username").trim() };
  const fieldErrors: Record<string, string> = {};
  const errs = { name: validateName(values.name), className: validateClassName(values.className), username: validateUsername(values.username) };
  for (const [k, v] of Object.entries(errs)) if (v) fieldErrors[k] = v;
  return { values: { ...values, className: values.className && formatClass(values.className) }, fieldErrors };
}

/** What 2b shows after 2a. Returned to the page once; the password is never stored in plain text. */
export type CreatedStudent = { id: string; name: string; className: string; username: string; password: string };
export type CreateState = FormState & { created?: CreatedStudent };

// 2a → 2b
export async function createStudent(_prev: CreateState, form: FormData): Promise<CreateState> {
  const { actor } = await requireShell("parent");
  const { values, fieldErrors } = readDetails(form);
  const password = text(form, "password");
  const pwErr = validatePassword(password);
  if (pwErr) fieldErrors.password = pwErr;
  const echo = { ...values, password };
  if (Object.keys(fieldErrors).length) return { fieldErrors, values: echo };

  const res = await students.createStudent(actor, { ...values, password });
  if (!res.ok) return res.reason === "username_taken" ? { fieldErrors: { username: TAKEN }, values: echo } : { error: "You can't add a student from this account.", values: echo };
  revalidatePath("/students");
  return { created: { id: res.student.id, name: res.student.name, className: res.student.className, username: res.student.username ?? "", password } };
}

// 5e: details
export async function updateStudent(studentId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { actor } = await requireShell("parent");
  const { values, fieldErrors } = readDetails(form);
  if (Object.keys(fieldErrors).length) return { fieldErrors, values };
  const res = await students.updateStudentDetails(actor, studentId, values);
  if (!res.ok) {
    if (res.reason === "not_found") redirect("/students");
    return { fieldErrors: { username: TAKEN }, values };
  }
  revalidatePath("/students");
  return { notice: "Changes saved.", values };
}

// 5e: password
export async function setStudentPassword(studentId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { actor } = await requireShell("parent");
  const password = text(form, "password");
  const err = validatePassword(password);
  if (err) return { fieldErrors: { password: err }, values: { password } };
  const student = await students.getOwnStudent(actor, studentId);
  if (!student || !(await students.setStudentPassword(actor, studentId, password))) redirect("/students");
  return {
    notice: `New password saved. ${student.name} has been signed out and will need it, plus a code from your email, to sign in again.`,
    values: { password },
  };
}

// 5e: remove (after the inline confirmation)
export async function removeStudent(studentId: string): Promise<void> {
  const { actor } = await requireShell("parent");
  const student = await students.getOwnStudent(actor, studentId);
  if (student) await students.removeStudent(actor, studentId);
  revalidatePath("/students");
  redirect(student ? `/students?removed=${encodeURIComponent(student.name)}` : "/students");
}
