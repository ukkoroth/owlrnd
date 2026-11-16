"use client";

import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";

const LENGTH = 6;

/**
 * Six one-digit boxes (screens 1b, 3b, 5f, 5h). Named d0…d5 so the form works without JavaScript;
 * with JavaScript it auto-advances, handles backspace, and spreads a pasted or autofilled code across the boxes.
 */
/** `showLabel` shows the label above the boxes (sm-1f); otherwise it is for screen readers only. */
export function CodeInput({
  invalid = false,
  label = "6-digit code",
  autoFocus = false,
  showLabel = false,
}: {
  invalid?: boolean;
  label?: string;
  autoFocus?: boolean;
  showLabel?: boolean;
}) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  const fill = (start: number, digits: string) => {
    const chars = digits.replace(/\D/g, "").slice(0, LENGTH - start).split("");
    chars.forEach((c, i) => {
      const box = boxes.current[start + i];
      if (box) box.value = c;
    });
    boxes.current[Math.min(start + chars.length, LENGTH - 1)]?.focus();
  };

  const onInput = (i: number, el: HTMLInputElement) => {
    const digits = el.value.replace(/\D/g, "");
    if (digits.length > 1) {
      el.value = "";
      fill(i, digits); // autofill or fast typing
    } else {
      el.value = digits;
      if (digits) boxes.current[i + 1]?.focus();
    }
  };

  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    if (e.key === "Backspace" && !el.value && i > 0) {
      const prev = boxes.current[i - 1];
      if (prev) {
        prev.value = "";
        prev.focus();
      }
      e.preventDefault();
    } else if (e.key === "ArrowLeft" && i > 0) boxes.current[i - 1]?.focus();
    else if (e.key === "ArrowRight" && i < LENGTH - 1) boxes.current[i + 1]?.focus();
  };

  const onPaste = (i: number, e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    fill(i, e.clipboardData.getData("text"));
  };

  return (
    <fieldset>
      <legend className={showLabel ? "mb-1.5 text-[13px] font-semibold text-ink-muted" : "sr-only"}>{label}</legend>
      <div className="flex justify-between gap-2">
        {Array.from({ length: LENGTH }, (_, i) => (
          <input
            key={i}
            ref={(el) => {
              boxes.current[i] = el;
            }}
            name={`d${i}`}
            aria-label={`Digit ${i + 1} of ${LENGTH}`}
            aria-invalid={invalid || undefined}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            autoFocus={autoFocus && i === 0}
            maxLength={i === 0 ? LENGTH : 1}
            onInput={(e) => onInput(i, e.currentTarget)}
            onKeyDown={(e) => onKeyDown(i, e)}
            onPaste={(e) => onPaste(i, e)}
            onFocus={(e) => e.currentTarget.select()}
            className={`h-[58px] w-full min-w-0 rounded border bg-card text-center text-2xl font-semibold text-ink focus:border-brand ${
              invalid ? "border-danger" : "border-line-input"
            }`}
          />
        ))}
      </div>
    </fieldset>
  );
}
