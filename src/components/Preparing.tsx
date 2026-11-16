/**
 * "Exam being prepared" (owner, 2026-11-16): shown wherever a track's next exam is being written in the background,
 * so a learner or parent sees it is on its way rather than missing. A status line plus an indeterminate bar.
 */
export function Preparing({ label, note, className = "" }: { label: string; note?: string; className?: string }) {
  return (
    <div className={className} role="status">
      <p className="text-[15px] font-semibold text-ink">{label}</p>
      {note && <p className="mt-0.5 text-sm text-ink-muted">{note}</p>}
      <span className="preparing-bar mt-2.5 block h-1.5 rounded-full bg-pale-2" aria-hidden="true">
        <span />
      </span>
    </div>
  );
}
