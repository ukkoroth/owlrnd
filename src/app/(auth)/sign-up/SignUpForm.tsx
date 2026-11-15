"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { Field, FormError, SubmitButton } from "@/components/forms";
import { rules } from "@/config/rules";
import { emptyForm } from "@/lib/form";
import { signUp } from "../actions";

type Props = {
  initialName?: string;
  /** The address the invitation was sent to; the parent may still use another. */
  initialEmail?: string;
  /** Invitation token from the link (closed beta). */
  invite?: string;
  changingEmail: boolean;
};

export function SignUpForm({ initialName, initialEmail, invite, changingEmail }: Props) {
  const [state, action] = useActionState(signUp, emptyForm);
  // The student's "today" uses the time zone of the device the parent signs up on (decisions: time zone).
  const [timeZone, setTimeZone] = useState("");
  useEffect(() => {
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);
  const v = state.values;

  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError>{state.error}</FormError>
      <input type="hidden" name="timeZone" value={timeZone} />
      {invite && <input type="hidden" name="invite" value={invite} />}
      <Field label="Your name" name="name" autoComplete="name" required defaultValue={v?.name ?? initialName} key={`n-${v?.name ?? initialName}`} error={state.fieldErrors?.name} />
      <Field
        label={changingEmail ? "New email" : "Email"}
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={v?.email ?? initialEmail}
        key={`e-${v?.email ?? initialEmail}`}
        error={state.fieldErrors?.email}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={rules.accounts.passwordMinLength}
        hint={`At least ${rules.accounts.passwordMinLength} characters.`}
        error={state.fieldErrors?.password}
      />
      <SubmitButton>{changingEmail ? "Send a new code" : "Create account"}</SubmitButton>
      {!changingEmail && (
        <p className="m-0 text-[13px] text-ink-muted">
          By creating an account you agree to the{" "}
          <Link href="/terms" className="link">
            terms of use
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="link">
            privacy policy
          </Link>
          .
        </p>
      )}
      <p className="mt-2 text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link href="/sign-in" className="link font-semibold">
          Sign in
        </Link>
      </p>
    </form>
  );
}
