"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { DateOfBirthField, Field, FormError, SubmitButton } from "@/components/forms";
import { rules } from "@/config/rules";
import { emptyForm } from "@/lib/form";
import { signUpLearner } from "../actions";

type Props = {
  initialName?: string;
  initialEmail?: string;
  /** Invitation token from the link (only while sign-up is invite-only). */
  invite?: string;
  changingEmail: boolean;
};

/** sm-1b "Create your account" (For me): a self-managed learner. */
export function LearnerSignUpForm({ initialName, initialEmail, invite, changingEmail }: Props) {
  const [state, action] = useActionState(signUpLearner, emptyForm);
  // "Today" (streaks, daily limits) uses the time zone of the device they sign up on.
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
      <DateOfBirthField
        error={state.fieldErrors?.dob}
        values={{ day: v?.dobDay, month: v?.dobMonth, year: v?.dobYear }}
        hint={
          rules.accounts.ages.under18SelfSignUp
            ? "If you are under 18, a parent will be asked to agree before you start."
            : "You need to be 18 or over to sign up on your own. A parent can set up practice for younger learners."
        }
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
            I agree to the{" "}
            <Link href="/terms" className="link" target="_blank">
              terms of use
            </Link>{" "}
            and the{" "}
            <Link href="/privacy" className="link" target="_blank">
              privacy policy
            </Link>
            .
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
