import type { Bar } from "@/domain/activity";

const day = (iso: string) => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

/**
 * 7-day bar chart (rules §9): the last 7 days ending today, the count above each bar, today highlighted and labelled.
 * One series, so no legend; counts are always visible (the light bar colour needs that relief), and each bar has a
 * tooltip with the full date.
 */
export function ActivityBars({ bars, size = "lg" }: { bars: Bar[]; size?: "lg" | "sm" }) {
  const max = Math.max(1, ...bars.map((b) => b.count));
  const h = size === "lg" ? 84 : 40;
  const sm = size === "sm";
  return (
    <figure>
      <figcaption className="sr-only">
        Exams per day, last 7 days: {bars.map((b) => `${b.isToday ? "today" : day(b.date)} ${b.count}`).join(", ")}.
      </figcaption>
      <ol className={`flex items-end border-b border-ink ${sm ? "gap-3" : "gap-4 md:gap-8"}`} style={{ height: h + (sm ? 16 : 22) }} aria-hidden="true">
        {bars.map((b) => (
          <li key={b.date} className="flex flex-1 flex-col items-center justify-end" title={`${day(b.date)}: ${b.count} ${b.count === 1 ? "exam" : "exams"}`}>
            <span className={`${sm ? "text-[11px]" : "text-[14px]"} font-semibold text-ink-muted`}>{b.count}</span>
            <span
              className={`mt-1 w-full rounded-t-[4px] ${b.isToday ? "bg-brand" : "bg-[#A9C4FF]"}`}
              style={{ height: b.count ? Math.max(4, (b.count / max) * h) : 0, maxWidth: sm ? 26 : 56 }}
            />
          </li>
        ))}
      </ol>
      <ol className={`mt-2 flex ${sm ? "gap-3" : "gap-4 md:gap-8"}`} aria-hidden="true">
        {bars.map((b) => (
          <li key={b.date} className={`flex-1 text-center ${sm ? "text-[11px]" : "text-[14px]"} ${b.isToday ? "font-semibold text-ink" : "text-ink-muted"}`}>
            {sm && !b.isToday ? b.label[0] : b.label}
          </li>
        ))}
      </ol>
    </figure>
  );
}
