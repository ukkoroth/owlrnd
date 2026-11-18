"use client";

import { useFormStatus } from "react-dom";
import { trySample } from "@/app/_actions/tracks";

function Submit({ className }: { className: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending} aria-busy={pending}>
      {pending ? "Setting it up…" : "Try a sample track"}
    </button>
  );
}

/**
 * "Try a sample track" (owner, 2026-11-18): adds "The Solar System", written in advance, so the first exam is
 * ready at once with no AI and no setup.
 */
export function TrySample({ studentId, className = "btn-outline h-[52px] px-6" }: { studentId: string; className?: string }) {
  return (
    <form action={trySample.bind(null, studentId)}>
      <Submit className={className} />
    </form>
  );
}
