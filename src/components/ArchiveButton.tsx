"use client";

import { useState } from "react";
import { archive } from "@/app/(parent)/students/[id]/tracks/[trackId]/actions";

/** Archive with a confirm step (rules §2: hides the track from the student, keeps its history). */
export function ArchiveButton({ trackId, studentId, trackName, studentName }: { trackId: string; studentId: string; trackName: string; studentName: string }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button type="button" className="link min-h-touch font-semibold no-underline hover:underline" onClick={() => setConfirming(true)} aria-label={`Archive ${trackName}`}>
        Archive
      </button>
    );
  }
  return (
    <form action={archive.bind(null, trackId, studentId)} className="flex flex-wrap items-center gap-3" role="group" aria-label={`Archive ${trackName}?`}>
      <span className="text-sm text-ink-muted">Hide it from {studentName}? Its history stays here.</span>
      <button className="btn-outline h-10 min-h-0 px-3 text-sm">Archive</button>
      <button type="button" className="link text-sm" onClick={() => setConfirming(false)}>
        Cancel
      </button>
    </form>
  );
}
