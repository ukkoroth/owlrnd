"use client";

import { useState } from "react";
import { archive, remove, restore } from "@/app/_actions/tracks";

/**
 * Archive with a confirm step (roadmap 22: any track; it leaves the learner's lists and keeps its history). When the
 * track has an exam ready or in progress, the confirmation says it will be discarded.
 */
export function ArchiveButton({
  trackId,
  studentId,
  trackName,
  question,
  examOpen = false,
}: {
  trackId: string;
  studentId: string;
  trackName: string;
  question: string;
  examOpen?: boolean;
}) {
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
      <span className="text-sm text-ink-muted">
        {question}
        {examOpen && " The exam that's waiting will be discarded."}
      </span>
      <button className="btn-outline h-10 min-h-0 px-3 text-sm">Archive</button>
      <button type="button" className="link text-sm" onClick={() => setConfirming(false)}>
        Cancel
      </button>
    </form>
  );
}

/** Restore an archived track to the status it had. */
export function RestoreButton({ trackId, studentId, trackName }: { trackId: string; studentId: string; trackName: string }) {
  return (
    <form action={restore.bind(null, trackId, studentId)}>
      <button className="link min-h-touch text-sm font-semibold" aria-label={`Restore ${trackName}`}>
        Restore
      </button>
    </form>
  );
}

/**
 * Delete for good, after a confirmation that names the track (roadmap 22). Points already earned stay.
 * `then`: where to go afterwards when deleting from the track's own page.
 */
export function DeleteTrackButton({ trackId, studentId, trackName, then = null }: { trackId: string; studentId: string; trackName: string; then?: string | null }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button type="button" className="min-h-touch text-sm font-semibold text-danger-text hover:underline" onClick={() => setConfirming(true)} aria-label={`Delete ${trackName}`}>
        Delete
      </button>
    );
  }
  return (
    <form action={remove.bind(null, trackId, studentId, then)} className="flex w-full flex-wrap items-center gap-3" role="group" aria-label={`Delete ${trackName}?`}>
      <span className="text-sm text-ink">
        Delete <strong>{trackName}</strong> for good? Its topics, material, exams, answers and flashcards are removed and can&apos;t be brought back. Points already
        earned stay.
      </span>
      <button className="btn-danger h-10 min-h-0 px-3 text-sm">Delete for good</button>
      <button type="button" className="link text-sm" onClick={() => setConfirming(false)}>
        Cancel
      </button>
    </form>
  );
}
