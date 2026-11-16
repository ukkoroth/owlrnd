import Link from "next/link";
import { formatUsd, type AllowanceState } from "@/domain/allowance";

// Bar colours on the dark sidebar (bg-sidebar #1E40AF); each is at least 3:1 against it, as WCAG asks of graphics.
// The text stays white or sidebar-muted (both above 4.5:1).
const FILL: Record<AllowanceState["level"], string> = {
  ok: "bg-white",
  warn: "bg-amber",
  used_up: "bg-[#FF9A8F]",
};

/**
 * "AI allowance" in the sidebar (0.2 plan, M7): how much of the demo allowance the account holder has used. Shown to
 * parents and self-managed learners only; a parent-managed learner's allowance is their parent's.
 */
export function AiAllowanceBox({ allowance }: { allowance: AllowanceState }) {
  const { usedUsd, limitUsd, percent, level } = allowance;
  const label = `${formatUsd(Math.round(usedUsd * 100) / 100)} of ${formatUsd(limitUsd)} used`;
  return (
    <div className="flex flex-col gap-2 rounded border border-white/70 px-3 py-2.5">
      <span id="ai-allowance-label" className="text-[13px] font-semibold">
        AI allowance
      </span>
      <div
        role="progressbar"
        aria-labelledby="ai-allowance-label"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={label}
        className="h-1.5 w-full overflow-hidden rounded-full bg-white/25"
      >
        <div className={`h-full rounded-full ${FILL[level]}`} style={{ width: `${percent}%` }} />
      </div>
      <span className="text-[13px] text-sidebar-muted">{label}</span>
      {level === "used_up" && (
        <Link href="/contact?topic=package" className="flex min-h-touch items-center text-[13px] font-semibold text-white underline underline-offset-2 hover:no-underline">
          Contact us to buy a package
        </Link>
      )}
    </div>
  );
}
