"use client";

import Link from "next/link";
import { startTransition, useActionState, useState, type ReactNode } from "react";
import { CodeInput } from "@/components/CodeInput";
import { FormError, Notice, SubmitButton } from "@/components/forms";
import { emptyForm, type FormState } from "@/lib/form";

type Props = {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  resend: (prev: FormState) => Promise<FormState>;
  submitLabel: string;
  resendLabel: string;
  back: { href: string; label: string };
  /** Shown when the page opened after the hourly send limit was hit. */
  initialError?: string;
  /** Extra fields between the code and the button (5h: new password). */
  children?: (state: FormState) => ReactNode;
  footnote: ReactNode;
};

/**
 * Code entry shared by 1b, 3b/5f, 5h and the email change. "Send a new code" is a plain button rather than a
 * form action, so it never resets digits the person has started typing.
 */
export function CodeForm({ action, resend, submitLabel, resendLabel, back, initialError, children, footnote }: Props) {
  const [state, submit, submitting] = useActionState(action, emptyForm);
  const [resent, doResend, resending] = useActionState(resend, emptyForm);
  // Whichever was used last decides the message: a resend clears an earlier wrong-code error.
  const [last, setLast] = useState<"submit" | "resend" | null>(null);
  const latest = last === "resend" ? resent : state;

  return (
    <form
      // Without JavaScript the form posts to the action. With it, onSubmit dispatches by hand, which skips
      // React's automatic form reset, so the digits stay on screen after a wrong code (as in screen 5f).
      action={submit}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setLast("submit");
        startTransition(() => submit(fd));
      }}
      className="flex flex-col gap-4"
      noValidate
    >
      <FormError>{latest.error ?? (last === null ? initialError : undefined)}</FormError>
      <Notice>{latest.notice}</Notice>
      <CodeInput invalid={last === "submit" && !!state.codeInvalid} autoFocus />
      {children?.(state)}
      <SubmitButton pending={submitting}>{submitLabel}</SubmitButton>
      <div className="mt-3 flex justify-between text-sm font-semibold">
        <button
          type="button"
          disabled={resending}
          onClick={() => {
            setLast("resend");
            startTransition(() => doResend());
          }}
          className="link min-h-touch disabled:opacity-60"
        >
          {resendLabel}
        </button>
        <Link href={back.href} className="link flex min-h-touch items-center">
          {back.label}
        </Link>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{footnote}</p>
    </form>
  );
}
