"use client";

import Link from "next/link";
import { rules } from "@/config/rules";
import { useActionState } from "react";
import { Field, FormError, Notice, SubmitButton } from "@/components/forms";
import { emptyForm } from "@/lib/form";
import { signIn } from "../actions";

export function SignInForm({ notice }: { notice?: string }) {
  const [state, action] = useActionState(signIn, emptyForm);
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
      <Field label="Password" name="password" type="password" autoComplete="current-password" required />
      <SubmitButton>Sign in</SubmitButton>
      <p className="mt-3 text-center text-sm">
        <Link href="/forgot-password" className="link">
          Forgot password?
        </Link>
      </p>
      <p className="text-center text-sm text-ink-muted md:hidden">
        New to owlrnd?{" "}
        <Link href={rules.access.inviteOnly ? "/get-access" : "/sign-up"} className="link font-semibold">
          {rules.access.inviteOnly ? "Get access" : "Create a parent account"}
        </Link>
      </p>
    </form>
  );
}
