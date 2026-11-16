"use client";

import { useActionState } from "react";
import { Field, FormError, SubmitButton } from "@/components/forms";
import { emptyForm } from "@/lib/form";
import { sendPackageRequest } from "./actions";

const DEFAULT_MESSAGE = "I'd like to buy a package so I can keep using owlrnd.";

/** Name and email are filled in for a signed-in account holder. */
export function PackageRequestForm({ name, email }: { name?: string; email?: string }) {
  const [state, action] = useActionState(sendPackageRequest, emptyForm);
  const v = state.values;
  const msgErr = state.fieldErrors?.message;

  return (
    <form action={action} className="card flex flex-col gap-4">
      <FormError>{state.error}</FormError>
      <Field label="Your name" name="name" autoComplete="name" required defaultValue={v?.name ?? name} key={`n-${v?.name}`} error={state.fieldErrors?.name} />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        hint="We'll reply here."
        defaultValue={v?.email ?? email}
        key={`e-${v?.email}`}
        error={state.fieldErrors?.email}
      />
      <div>
        <label htmlFor="f-message" className="label text-[13px] text-ink-muted">
          Message
        </label>
        <textarea
          id="f-message"
          name="message"
          rows={4}
          maxLength={2000}
          required
          defaultValue={v?.message ?? DEFAULT_MESSAGE}
          key={`m-${v?.message}`}
          aria-invalid={msgErr ? true : undefined}
          aria-describedby={msgErr ? "f-message-err" : undefined}
          className={`input min-h-[110px] py-2.5 ${msgErr ? "border-danger" : ""}`}
        />
        {msgErr && (
          <p id="f-message-err" className="mt-1 text-[13px] font-semibold text-danger-text">
            {msgErr}
          </p>
        )}
      </div>
      {/* Left empty by people; see actions.ts. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="f-website">Website</label>
        <input id="f-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <SubmitButton pendingText="Sending…">Send</SubmitButton>
    </form>
  );
}
