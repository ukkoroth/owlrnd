"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormError, SubmitButton } from "@/components/forms";
import { rules } from "@/config/rules";
import { emptyForm } from "@/lib/form";
import { changePassword, deleteAccount, startEmailChange, updateName } from "./actions";

const Cancel = () => (
  <Link href="/parent/profile" className="btn-outline">
    Cancel
  </Link>
);

export function NameForm({ name }: { name: string }) {
  const [state, action] = useActionState(updateName, emptyForm);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Name" name="name" autoComplete="name" required defaultValue={state.values?.name ?? name} error={state.fieldErrors?.name} />
      <div className="flex gap-3">
        <SubmitButton className="btn-primary">Save</SubmitButton>
        <Cancel />
      </div>
    </form>
  );
}

export function EmailForm() {
  const [state, action] = useActionState(startEmailChange, emptyForm);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError>{state.error}</FormError>
      <Field label="New email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} key={state.values?.email} error={state.fieldErrors?.email} />
      <div className="flex gap-3">
        <SubmitButton className="btn-primary">Send code</SubmitButton>
        <Cancel />
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, emptyForm);
  const f = state.fieldErrors;
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Current password" name="current" type="password" autoComplete="current-password" required error={f?.current} />
      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint={`At least ${rules.accounts.passwordMinLength} characters.`}
        error={f?.password}
      />
      <Field label="Type it again" name="confirm" type="password" autoComplete="new-password" required error={f?.confirm} />
      <div className="flex gap-3">
        <SubmitButton className="btn-primary">Change password</SubmitButton>
        <Cancel />
      </div>
    </form>
  );
}

export function DeleteForm() {
  const [state, action] = useActionState(deleteAccount, emptyForm);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Your password" name="password" type="password" autoComplete="current-password" required error={state.fieldErrors?.password} />
      <div className="flex gap-3">
        <SubmitButton className="btn-danger">Delete my account</SubmitButton>
        <Cancel />
      </div>
    </form>
  );
}
