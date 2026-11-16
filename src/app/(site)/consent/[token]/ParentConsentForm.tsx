"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { CodeInput } from "@/components/CodeInput";
import { FormError, Notice } from "@/components/forms";
import { emptyForm } from "@/lib/form";
import { answerParent, sendParentCode } from "@/app/_actions/consent";

/** sm-1f: the code sent to the parent's email, the consent box, the optional progress view, Decline / I agree. */
export function ParentConsentForm({ token, learnerName, maskedEmail }: { token: string; learnerName: string; maskedEmail: string }) {
  const [state, submit, submitting] = useActionState(answerParent.bind(null, token), emptyForm);
  const [resent, doResend, resending] = useActionState(sendParentCode.bind(null, token), emptyForm);
  const [last, setLast] = useState<"submit" | "resend" | null>(null);
  const latest = last === "resend" ? resent : state;

  return (
    <form
      action={submit}
      onSubmit={(e) => {
        // Dispatched by hand so the digits stay on screen after a wrong code; the pressed button says which answer.
        e.preventDefault();
        const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        setLast("submit");
        startTransition(() => submit(fd));
      }}
      className="flex flex-col gap-4"
      noValidate
    >
      <FormError>{latest.error}</FormError>
      <Notice>{latest.notice}</Notice>
      <div>
        <CodeInput invalid={last === "submit" && !!state.codeInvalid} label={`Confirm it's you: enter the 6-digit code we sent to ${maskedEmail}`} showLabel />
        <div className="mt-1 flex justify-between text-[13px]">
          <span className="text-ink-muted">Valid for 10 minutes.</span>
          <button
            type="button"
            disabled={resending}
            onClick={() => {
              setLast("resend");
              startTransition(() => doResend());
            }}
            className="link min-h-touch font-semibold disabled:opacity-60"
          >
            Send a new code
          </button>
        </div>
      </div>
      <div>
        <label htmlFor="f-consent" className="flex min-h-touch cursor-pointer items-start gap-3 text-[15px] leading-snug">
          <input
            id="f-consent"
            name="consent"
            type="checkbox"
            value="yes"
            aria-invalid={state.fieldErrors?.consent ? true : undefined}
            aria-describedby={state.fieldErrors?.consent ? "f-consent-err" : undefined}
            className="mt-0.5 h-5 w-5 shrink-0 accent-brand"
          />
          <span>
            I am {learnerName}&apos;s parent or lawful guardian, and I agree to owlrnd processing {learnerName}&apos;s data as described.
          </span>
        </label>
        {state.fieldErrors?.consent && (
          <p id="f-consent-err" className="mt-1 text-[13px] font-semibold text-danger-text">
            {state.fieldErrors.consent}
          </p>
        )}
      </div>
      <label htmlFor="f-progress" className="flex min-h-touch cursor-pointer items-start gap-3 text-[15px] leading-snug">
        <input id="f-progress" name="progressView" type="checkbox" value="yes" className="mt-0.5 h-5 w-5 shrink-0 accent-brand" />
        <span>Also let me see {learnerName}&apos;s progress (read-only). Optional.</span>
      </label>
      <div className="grid grid-cols-[1fr_1.6fr] gap-3">
        <button type="submit" name="answer" value="decline" className="btn-outline h-[52px]" disabled={submitting}>
          Decline
        </button>
        <button type="submit" name="answer" value="agree" className="btn-primary h-[52px]" disabled={submitting}>
          I agree
        </button>
      </div>
      <p className="text-[13px] leading-relaxed text-ink-muted">
        If you decline, {learnerName}&apos;s account is closed and its data deleted. Questions?{" "}
        <Link href="/contact" className="link">
          Contact us
        </Link>
        .
      </p>
    </form>
  );
}
