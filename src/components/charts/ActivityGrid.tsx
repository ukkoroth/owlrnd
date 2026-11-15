import type { Grid } from "@/domain/activity";

const SHADES = ["bg-activity-0", "bg-activity-1", "bg-activity-2", "bg-activity-3", "bg-activity-4"];
const day = (iso: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

/**
 * 26-week activity grid (rules §9): one square per day, weeks as columns, days as rows (Sunday first), today
 * outlined. Five shades for 0, 1, 2, 3 and 4+ exams. Every square has a tooltip; the light shades are faint, so a
 * table of weekly totals is one click away for anyone who can't read them.
 */
export function ActivityGrid({ grid, size = "lg" }: { grid: Grid; size?: "lg" | "sm" }) {
  const sm = size === "sm";
  const cell = sm ? 11 : 16;
  const gap = sm ? 2 : 4;
  return (
    <figure>
      <figcaption className="sr-only">
        Practice activity for the last 26 weeks: {grid.total} {grid.total === 1 ? "exam" : "exams"} in total. A table of weekly totals follows.
      </figcaption>
      <div className="flex" aria-hidden="true">
        {!sm && (
          <div className="mr-2 grid text-[12px] text-ink-muted" style={{ gridTemplateRows: `${cell}px repeat(7, ${cell}px)`, rowGap: gap }}>
            {["", "", "Mon", "", "Wed", "", "Fri", ""].map((l, i) => (
              <span key={i} className="leading-none">
                {l}
              </span>
            ))}
          </div>
        )}
        {/* When it doesn't fit (phones), it scrolls; rtl makes it open on the latest weeks, with today in view. */}
        <div className="min-w-0 flex-1 overflow-x-auto [direction:rtl]">
          <div className="w-max [direction:ltr]">
          {!sm && (
            <div className="relative mb-1 text-[12px] text-ink-muted" style={{ height: cell - 4, width: grid.weeks.length * (cell + gap) }}>
              {grid.months.map((m) => (
                <span key={m.column} className="absolute" style={{ left: m.column * (cell + gap) }}>
                  {m.label}
                </span>
              ))}
            </div>
          )}
          <div className="grid grid-flow-col" style={{ gridTemplateRows: `repeat(7, ${cell}px)`, gridAutoColumns: `${cell}px`, gap }}>
            {grid.weeks.flat().map((c) =>
              c.future ? (
                <span key={c.date} />
              ) : (
                <span
                  key={c.date}
                  title={`${day(c.date)}: ${c.count} ${c.count === 1 ? "exam" : "exams"}${c.isToday ? " (today)" : ""}`}
                  data-today={c.isToday || undefined}
                  className={`rounded-[3px] ${SHADES[c.shade]} ${c.isToday ? "outline outline-2 outline-offset-1 outline-ink" : ""}`}
                />
              ),
            )}
          </div>
          </div>
        </div>
      </div>
      <div className={`mt-3 flex flex-wrap items-center justify-between gap-3 ${sm ? "text-[11px]" : "text-[13px]"} text-ink-muted`}>
        {!sm && <span>Each square is one day. Darker means more exams practised. Today is outlined.</span>}
        <span className="flex items-center gap-1.5" aria-hidden="true">
          Fewer
          {SHADES.map((s) => (
            <span key={s} className={`inline-block rounded-[3px] ${s}`} style={{ width: cell - 2, height: cell - 2 }} />
          ))}
          More
        </span>
      </div>
      <details className={`mt-2 ${sm ? "text-[12px]" : "text-sm"}`}>
        <summary className="link inline-flex min-h-touch cursor-pointer items-center">Show as a table</summary>
        <table className="mt-2 w-full max-w-[360px] text-left">
          <caption className="sr-only">Exams per week, last 26 weeks</caption>
          <thead>
            <tr className="text-ink-muted">
              <th scope="col" className="py-1 font-semibold">
                Week starting
              </th>
              <th scope="col" className="py-1 text-right font-semibold">
                Exams
              </th>
            </tr>
          </thead>
          <tbody>
            {[...grid.weeks].reverse().map((w) => (
              <tr key={w[0]!.date} className="border-t border-line">
                <td className="py-1">{day(w[0]!.date)}</td>
                <td className="py-1 text-right">{w.reduce((s, c) => s + c.count, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
