import Link from "next/link";
import { examHoldNote, type ExamHold, type HoldViewer } from "@/domain/examHold";

/**
 * "Exam being prepared" (owner, 2026-11-16): shown wherever a track's next exam is being written in the background,
 * so a learner or parent sees it is on its way rather than missing. A status line plus an indeterminate bar.
 * While the writing is postponed (`hold`, e.g. the AI allowance is used up) it says why instead, without the bar.
 */
export function Preparing({
  label,
  note,
  className = "",
  hold,
  viewer = "child",
}: {
  label: string;
  note?: string;
  className?: string;
  hold?: ExamHold | null;
  viewer?: HoldViewer;
}) {
  if (hold) {
    return (
      <div className={className} role="status">
        <p className="text-[15px] font-semibold text-ink">{label.replace(/being prepared…?$/, "on hold")}</p>
        <p className="mt-0.5 text-sm text-ink-muted">{examHoldNote(hold, viewer)}</p>
        {hold === "allowance" && viewer === "holder" && (
          <Link href="/contact?topic=package" className="link flex min-h-touch items-center text-sm font-semibold">
            Contact us to buy a package
          </Link>
        )}
      </div>
    );
  }
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
