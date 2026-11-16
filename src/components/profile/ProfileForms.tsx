"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormError, SubmitButton } from "@/components/forms";
import { rules } from "@/config/rules";
import { emptyForm } from "@/lib/form";
import { changePassword, deleteAccount, startEmailChange, updateName } from "@/app/_actions/profile";

/** Back to the profile: /parent/profile for a parent, /profile for a self-managed learner. */
const Cancel = ({ base }: { base: string }) => (
  <Link href={base} className="btn-outline">
    Cancel
  </Link>
);

export function NameForm({ name, base }: { name: string; base: string }) {
  const [state, action] = useActionState(updateName, emptyForm);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Name" name="name" autoComplete="name" required defaultValue={state.values?.name ?? name} error={state.fieldErrors?.name} />
      <div className="flex gap-3">
        <SubmitButton className="btn-primary">Save</SubmitButton>
        <Cancel base={base} />
      </div>
    </form>
  );
}

export function EmailForm({ base }: { base: string }) {
  const [state, action] = useActionState(startEmailChange, emptyForm);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError>{state.error}</FormError>
      <Field label="New email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} key={state.values?.email} error={state.fieldErrors?.email} />
      <div className="flex gap-3">
        <SubmitButton className="btn-primary">Send code</SubmitButton>
        <Cancel base={base} />
      </div>
    </form>
  );
}

export function PasswordForm({ base }: { base: string }) {
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
        <Cancel base={base} />
      </div>
    </form>
  );
}

export function DeleteForm({ base }: { base: string }) {
  const [state, action] = useActionState(deleteAccount, emptyForm);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Your password" name="password" type="password" autoComplete="current-password" required error={state.fieldErrors?.password} />
      <div className="flex gap-3">
        <SubmitButton className="btn-danger">Delete my account</SubmitButton>
        <Cancel base={base} />
      </div>
    </form>
  );
}
