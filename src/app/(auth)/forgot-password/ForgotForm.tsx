"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormError, Notice, SubmitButton } from "@/components/forms";
import { emptyForm } from "@/lib/form";
import { forgotPassword } from "../actions";

export function ForgotForm({ notice }: { notice?: string }) {
  const [state, action] = useActionState(forgotPassword, emptyForm);
  return (
    <form action={action} className="flex flex-col gap-4">
      {state === emptyForm && <Notice>{notice}</Notice>}
      <FormError>{state.error}</FormError>
      <Field
        label="Username or email"
        name="identifier"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        defaultValue={state.values?.identifier}
        key={`id-${state.values?.identifier ?? ""}`}
      />
      <SubmitButton>Send reset code</SubmitButton>
      <p className="mt-3 text-center text-sm">
        <Link href="/sign-in" className="link">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
