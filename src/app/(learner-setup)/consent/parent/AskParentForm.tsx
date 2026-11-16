"use client";

import { useActionState } from "react";
import { Field, FormError, SubmitButton } from "@/components/forms";
import { rules } from "@/config/rules";
import { emptyForm } from "@/lib/form";
import { askParent } from "@/app/_actions/consent";

/** sm-1d: the parent or guardian's name and email. */
export function AskParentForm({ name, email }: { name?: string; email?: string }) {
  const [state, action] = useActionState(askParent, emptyForm);
  const v = state.values;
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError>{state.error}</FormError>
      <Field label="Parent or guardian's name" name="parentName" autoComplete="off" required defaultValue={v?.parentName ?? name} key={`n-${v?.parentName}`} error={state.fieldErrors?.parentName} />
      <Field
        label="Their email"
        name="parentEmail"
        type="email"
        autoComplete="off"
        required
        hint={`We will email them a link. It is valid for ${rules.consent.linkDays} days.`}
        defaultValue={v?.parentEmail ?? email}
        key={`e-${v?.parentEmail}`}
        error={state.fieldErrors?.parentEmail}
      />
      <SubmitButton>Send and continue</SubmitButton>
      <p className="rounded bg-pale px-4 py-3 text-[14px] leading-snug text-ink">
        We will email them now and remind them after {rules.consent.reminderAfterDays} days. If they decline, your account is closed and its data deleted.
      </p>
    </form>
  );
}
