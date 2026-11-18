"use client";

import { useActionState } from "react";
import { setQuestionMode } from "@/app/_actions/tracks";

const MODES = [
  {
    value: "pool",
    label: "Ready at once",
    note: "Questions are written in batches and each exam is picked from them with the same focus on weak topics. Exams are there straight away, and practice carries on for a while if the AI allowance runs out.",
  },
  {
    value: "fresh",
    label: "Freshly written after each exam",
    note: "The AI writes every exam after the last one is marked, so there's a short wait, and up to 2 missed questions come back reworded in the very next exam.",
  },
] as const;

/** "How new exams are made" (owner, 2026-11-18): per track, for whoever controls it. Applies from the next exam. */
export function QuestionModeForm({ trackId, studentId, mode }: { trackId: string; studentId: string; mode: "pool" | "fresh" }) {
  const [state, action, pending] = useActionState(async (_prev: { saved: boolean } | null, form: FormData) => {
    await setQuestionMode(trackId, studentId, form);
    return { saved: true };
  }, null);
  return (
    <form action={action} className="card mt-8 max-w-[640px]">
      <fieldset>
        <legend className="text-lg font-semibold">How new exams are made</legend>
        <p className="mt-1 text-sm text-ink-muted">Changes apply from the next exam; an exam that is already waiting stays as it is.</p>
        <div className="mt-4 flex flex-col gap-3">
          {MODES.map((m) => (
            <label key={m.value} className="flex min-h-touch cursor-pointer gap-3 rounded border border-line p-3 has-[:checked]:border-brand">
              <input type="radio" name="mode" value={m.value} defaultChecked={mode === m.value} className="mt-1 h-5 w-5 shrink-0 accent-brand" />
              <span>
                <span className="block font-semibold">
                  {m.label}
                  {m.value === "pool" && <span className="ml-2 text-sm font-normal text-ink-muted">(default)</span>}
                </span>
                <span className="block text-sm text-ink-muted">{m.note}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button className="btn-outline h-11 px-5" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
        <p role="status" className="text-sm text-ink-muted">
          {state?.saved && !pending ? "Saved. It applies from the next exam." : ""}
        </p>
      </div>
    </form>
  );
}
