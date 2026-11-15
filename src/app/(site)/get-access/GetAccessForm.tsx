"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormError, SubmitButton } from "@/components/forms";
import { emptyForm } from "@/lib/form";
import { requestAccess } from "./actions";

export function GetAccessForm() {
  const [state, action] = useActionState(requestAccess, emptyForm);
  const v = state.values;
  const noteErr = state.fieldErrors?.note;

  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError>{state.error}</FormError>
      <Field label="Your name" name="name" autoComplete="name" required defaultValue={v?.name} key={`n-${v?.name}`} error={state.fieldErrors?.name} />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        hint="We'll send your invitation here."
        defaultValue={v?.email}
        key={`e-${v?.email}`}
        error={state.fieldErrors?.email}
      />
      <div>
        <label htmlFor="f-note" className="label text-[13px] text-ink-muted">
          Your child&apos;s class and what they&apos;re studying (optional)
        </label>
        <textarea
          id="f-note"
          name="note"
          rows={3}
          maxLength={1000}
          defaultValue={v?.note}
          key={`t-${v?.note}`}
          aria-invalid={noteErr ? true : undefined}
          aria-describedby={noteErr ? "f-note-err" : undefined}
          className={`input min-h-[96px] py-2.5 ${noteErr ? "border-danger" : ""}`}
        />
        {noteErr && (
          <p id="f-note-err" className="mt-1 text-[13px] font-semibold text-danger-text">
            {noteErr}
          </p>
        )}
      </div>
      {/* Left empty by people; see actions.ts. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="f-website">Website</label>
        <input id="f-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <SubmitButton pendingText="Sending…">Get access</SubmitButton>
      <p className="m-0 text-[13px] text-ink-muted">
        We use these details only to send your invitation. See our{" "}
        <Link href="/privacy" className="link">
          privacy policy
        </Link>
        .
      </p>
    </form>
  );
}
