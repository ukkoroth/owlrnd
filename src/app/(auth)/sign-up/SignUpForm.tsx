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
      <div>
        <label htmlFor="f-consent" className="flex min-h-touch cursor-pointer items-start gap-3 text-[14px] leading-snug text-ink">
          <input
            id="f-consent"
            name="consent"
            type="checkbox"
            value="yes"
            required
            aria-invalid={state.fieldErrors?.consent ? true : undefined}
            aria-describedby={state.fieldErrors?.consent ? "f-consent-err" : undefined}
            className="mt-0.5 h-5 w-5 shrink-0 accent-brand"
          />
          <span>
            I am the parent or legal guardian of the children I will add, and I agree to the{" "}
            <Link href="/terms" className="link" target="_blank">
              terms of use
            </Link>{" "}
            and the{" "}
            <Link href="/privacy" className="link" target="_blank">
              privacy policy
            </Link>
            , including how owlrnd uses my children&apos;s data.
          </span>
        </label>
        {state.fieldErrors?.consent && (
          <p id="f-consent-err" className="mt-1 text-[13px] font-semibold text-danger-text">
            {state.fieldErrors.consent}
          </p>
        )}
      </div>
      <SubmitButton>{changingEmail ? "Send a new code" : "Create account"}</SubmitButton>
      <p className="mt-2 text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link href="/sign-in" className="link font-semibold">
          Sign in
        </Link>
      </p>
    </form>
  );
}
