import { activityGrid, dailyCounts, last7Days } from "@/domain/activity";
import { todayIn } from "@/domain/tracks";
import { ActivityBars } from "./ActivityBars";
import { ActivityGrid } from "./ActivityGrid";

/**
 * Both activity charts from one list of submission times (3c full size, 2k small). The same data on both (§9).
 * Flashcard sessions (0.3, F4) show as a second, narrower series on the 7-day bars when there were any that week;
 * they are never counted as exams, and the 26-week grid stays exams only.
 */
export function ActivityCharts({ times, timeZone, size, flashcards = [] }: { times: Date[]; timeZone: string; size: "lg" | "sm"; flashcards?: Date[] }) {
  const counts = dailyCounts(times, timeZone);
  const today = todayIn(timeZone);
  const bars = last7Days(counts, today, dailyCounts(flashcards, timeZone));
  const grid = activityGrid(counts, today);
  const week = bars.reduce((s, b) => s + b.count, 0);
  const weekCards = bars.reduce((s, b) => s + b.flashcards, 0);
  const plural = (n: number) => `${n} ${n === 1 ? "exam" : "exams"}`;
  const weekLine = `${plural(week)}${weekCards ? ` · ${weekCards} flashcard ${weekCards === 1 ? "session" : "sessions"}` : ""}`;

  if (size === "sm") {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <div className="mb-2 flex justify-between text-[13px]">
            <span className="font-semibold">Last 7 days</span>
            <span className="text-ink-muted">{weekLine}</span>
          </div>
          <ActivityBars bars={bars} size="sm" />
        </div>
        <div>
          <div className="mb-2 flex justify-between text-[13px]">
            <span className="font-semibold">Last 26 weeks</span>
            <span className="text-ink-muted">{plural(grid.total)}</span>
          </div>
          <ActivityGrid grid={grid} size="sm" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <section className="card" aria-labelledby="week-h">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 id="week-h" className="text-[18px]">
            {weekCards ? "Your practice in the last 7 days" : "Exams you practised in the last 7 days"}
          </h2>
          <span className="whitespace-nowrap text-sm text-ink-muted">{weekLine}</span>
        </div>
        <ActivityBars bars={bars} />
      </section>
      <section className="card" aria-labelledby="grid-h">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 id="grid-h" className="text-[18px]">
            Your practice activity
          </h2>
          <span className="text-sm text-ink-muted">{plural(grid.total)} in the last 26 weeks</span>
        </div>
        <ActivityGrid grid={grid} />
      </section>
    </div>
  );
}
