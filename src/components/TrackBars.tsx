import { rules } from "@/config/rules";
import { coverageMet, topicCoverage, type CoverageTopic } from "@/domain/goals";
import { goalLabel } from "@/domain/tracks";
import type { Strength } from "@/domain/topicStrength";

type T = { name: string; strength: Strength };
const label: Record<Strength, string> = { strong: "strong", needs_work: "needs work", not_tested: "not tested yet" };

/** "3 of 5 topics strong" with one segment per topic: strong filled, needs work outlined red, not tested pale (4.1a, 2g). */
export function TopicStrength({ topics, compact = false }: { topics: T[]; compact?: boolean }) {
  const strong = topics.filter((t) => t.strength === "strong").length;
  const untested = topics.every((t) => t.strength === "not_tested");
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="font-semibold">
          {strong} of {topics.length} {topics.length === 1 ? "topic" : "topics"} strong
        </span>
        {!compact && untested && <span className="text-ink-muted">Not tested yet</span>}
      </div>
      <ul className="mt-2 flex gap-1" aria-label={topics.map((t) => `${t.name}: ${label[t.strength]}`).join("; ")}>
        {topics.map((t) => (
          <li
            key={t.name}
            title={`${t.name}: ${label[t.strength]}`}
            className={`h-2.5 flex-1 rounded ${t.strength === "strong" ? "bg-brand" : t.strength === "needs_work" ? "border-2 border-danger bg-danger-fill" : "bg-pale-2"}`}
          />
        ))}
      </ul>
    </div>
  );
}

export function NeedsWork({ topics }: { topics: T[] }) {
  const weak = topics.filter((t) => t.strength === "needs_work").map((t) => t.name);
  const tested = topics.some((t) => t.strength !== "not_tested");
  if (!tested) return null;
  return (
    <p className="text-[15px] text-ink-muted">
      Needs work: <span className="text-ink">{weak.length ? weak.join(", ") : "nothing"}</span>
    </p>
  );
}

/** Small bars of the latest scores out of 10, the latest highlighted (4.1a, 2g). */
export function ScoreBars({ scores }: { scores: number[] }) {
  if (!scores.length) return null;
  return (
    <ol className="flex h-[52px] items-end gap-1.5 border-b border-ink pb-px" aria-label={`Latest scores: ${scores.map((s) => `${s} out of 10`).join(", ")}`}>
      {scores.map((s, i) => (
        <li key={i} className="flex w-[22px] flex-col items-center gap-0.5">
          <span className={`text-[11px] font-semibold ${i === scores.length - 1 ? "text-ink" : "text-ink-muted"}`}>{s}</span>
          <span className={`w-full rounded-t ${i === scores.length - 1 ? "bg-brand" : "bg-[#A9C4FF]"}`} style={{ height: `${Math.max(3, s * 3.2)}px` }} />
        </li>
      ))}
    </ol>
  );
}

export function StrengthLegend() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-muted" aria-hidden="true">
      <li className="flex items-center gap-1.5">
        <span className="h-2.5 w-4 rounded bg-brand" /> Strong topic
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-2.5 w-4 rounded border-2 border-danger bg-danger-fill" /> Needs work
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-2.5 w-4 rounded bg-pale-2" /> Not tested yet
      </li>
    </ul>
  );
}

/** Goal box with progress segments (2g, 4.1a). */
/**
 * Goal progress (rules §3). From 0.2 the goal also needs the active topics covered: with `topics`, it reads
 * "3 of 3 exams · 10 of 12 topics strong", and the bar fills only when both parts are complete.
 */
export function GoalProgress({
  threshold,
  runLength,
  progress,
  reached = false,
  topics,
}: {
  threshold: number;
  runLength: number;
  progress: number;
  reached?: boolean;
  topics?: CoverageTopic[];
}) {
  const coverageOn = rules.goal.coverage !== "off" && !!topics;
  const cover = topics ? topicCoverage(topics) : null;
  const covered = !coverageOn || coverageMet(topics!);
  const runDone = progress >= runLength;
  const status = reached ? "Reached" : coverageOn && cover ? `${Math.min(progress, runLength)} of ${runLength} exams · ${cover.strong} of ${cover.total} topics strong` : `${progress} of ${runLength}`;
  return (
    <div className="rounded bg-page px-3 py-2.5">
      <div className="flex justify-between gap-3 text-sm">
        <span>
          <strong>Goal:</strong> {goalLabel({ threshold, runLength })}
        </span>
        <span className={`shrink-0 text-right font-semibold ${reached ? "text-brand" : "text-ink-muted"}`}>{status}</span>
      </div>
      <ul className="mt-2 flex gap-1" aria-hidden="true">
        {Array.from({ length: runLength }, (_, i) => (
          // The last step waits for the topics too, so a full bar always means the goal is reached.
          <li key={i} className={`h-2 flex-1 rounded ${reached || (i < progress && (i < runLength - 1 || !runDone || covered)) ? "bg-brand" : "bg-pale-2"}`} />
        ))}
      </ul>
    </div>
  );
}
