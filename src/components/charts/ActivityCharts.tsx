import { activityGrid, dailyCounts, last7Days } from "@/domain/activity";
import { todayIn } from "@/domain/tracks";
import { ActivityBars } from "./ActivityBars";
import { ActivityGrid } from "./ActivityGrid";

/** Both activity charts from one list of submission times (3c full size, 2k small). The same data on both (§9). */
export function ActivityCharts({ times, timeZone, size }: { times: Date[]; timeZone: string; size: "lg" | "sm" }) {
  const counts = dailyCounts(times, timeZone);
  const today = todayIn(timeZone);
  const bars = last7Days(counts, today);
  const grid = activityGrid(counts, today);
  const week = bars.reduce((s, b) => s + b.count, 0);
  const plural = (n: number) => `${n} ${n === 1 ? "exam" : "exams"}`;

  if (size === "sm") {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <div className="mb-2 flex justify-between text-[13px]">
            <span className="font-semibold">Last 7 days</span>
            <span className="text-ink-muted">{plural(week)}</span>
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
            Exams you practised in the last 7 days
          </h2>
          <span className="whitespace-nowrap text-sm text-ink-muted">{plural(week)}</span>
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
