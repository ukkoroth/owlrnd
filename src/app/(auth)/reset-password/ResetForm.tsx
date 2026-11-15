"use client";

import { Field } from "@/components/forms";
import { rules } from "@/config/rules";
import { resendResetCode, resetPassword } from "../actions";
import { CodeForm } from "@/components/CodeForm";

export function ResetForm({ initialError }: { initialError?: string }) {
  return (
    <CodeForm
      action={resetPassword}
      resend={resendResetCode}
      submitLabel="Save and sign in"
      resendLabel="Send a new code"
      back={{ href: "/sign-in", label: "Back to sign in" }}
      initialError={initialError}
      footnote="Codes expire after 10 minutes. After 3 wrong tries, a new code is sent automatically."
    >
      {(state) => (
        <>
          <Field
            label="New password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={rules.accounts.passwordMinLength}
            hint={`At least ${rules.accounts.passwordMinLength} characters.`}
            error={state.fieldErrors?.password}
          />
          <Field label="Type it again" name="confirm" type="password" autoComplete="new-password" error={state.fieldErrors?.confirm} />
        </>
      )}
    </CodeForm>
  );
}
