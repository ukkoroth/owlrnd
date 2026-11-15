"use client";

import { useFormStatus } from "react-dom";
import type { InputHTMLAttributes, ReactNode } from "react";

export function SubmitButton({
  children,
  className = "btn-primary w-full",
  pendingText,
  pending: pendingProp,
}: {
  children: ReactNode;
  className?: string;
  pendingText?: string;
  /** For forms submitted by hand (no form action), where useFormStatus can't see the submit. */
  pending?: boolean;
}) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <button type="submit" className={className} disabled={pending} aria-disabled={pending}>
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; error?: string; hint?: string };

export function Field({ label, name, error, hint, id, ...input }: FieldProps) {
  const inputId = id ?? `f-${name}`;
  const describedBy = [hint && `${inputId}-hint`, error && `${inputId}-err`].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={inputId} className="label text-[13px] text-ink-muted">
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`input h-[52px] ${error ? "border-danger" : ""}`}
        {...input}
      />
      {hint && !error && (
        <p id={`${inputId}-hint`} className="mt-1 text-[13px] text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${inputId}-err`} className="mt-1 text-[13px] font-semibold text-danger-text">
          {error}
        </p>
      )}
    </div>
  );
}

export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <div role="alert" className="flex gap-2.5 rounded border border-danger bg-danger-fill px-4 py-3 text-[15px] text-danger-text">
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v6M12 16.5v.5" />
      </svg>
      <span>{children}</span>
    </div>
  );
}

export function Notice({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <div role="status" className="rounded border border-line bg-pale-2 px-4 py-3 text-[15px] text-ink">
      {children}
    </div>
  );
}
