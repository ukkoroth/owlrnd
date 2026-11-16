import type { Bar } from "@/domain/activity";

const day = (iso: string) => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

/** Flashcard sessions (0.3): teal, validated against the exam blue (CVD ΔE 22, contrast ≥ 3:1). */
const CARDS = "#14A08F";
const sessions = (n: number) => `${n} flashcard ${n === 1 ? "session" : "sessions"}`;

/**
 * 7-day bar chart (rules §9): the last 7 days ending today, the count above each bar, today highlighted and labelled.
 * Exams only: one series, no legend; counts are always visible (the light bar colour needs that relief), and each
 * bar has a tooltip with the full date. With flashcard sessions that week (F4), a second, narrower teal bar beside
 * each day's exams, with its own count and a legend; one shared scale.
 */
export function ActivityBars({ bars, size = "lg" }: { bars: Bar[]; size?: "lg" | "sm" }) {
  const cards = bars.some((b) => b.flashcards > 0);
  const max = Math.max(1, ...bars.map((b) => Math.max(b.count, b.flashcards)));
  const h = size === "lg" ? 84 : 40;
  const sm = size === "sm";
  const height = (n: number) => (n ? Math.max(4, (n / max) * h) : 0);
  return (
    <figure>
      <figcaption className="sr-only">
        Exams per day, last 7 days: {bars.map((b) => `${b.isToday ? "today" : day(b.date)} ${b.count}`).join(", ")}.
        {cards && ` Flashcard sessions per day: ${bars.map((b) => `${b.isToday ? "today" : day(b.date)} ${b.flashcards}`).join(", ")}.`}
      </figcaption>
      {cards && (
        <p className={`mb-2 flex flex-wrap gap-x-4 gap-y-1 ${sm ? "text-[11px]" : "text-[13px]"} text-ink-muted`} aria-hidden="true">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-brand" />
            Exams
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: CARDS }} />
            Flashcard sessions
          </span>
        </p>
      )}
      <ol className={`flex items-end border-b border-ink ${sm ? "gap-3" : "gap-4 md:gap-8"}`} style={{ height: h + (sm ? 16 : 22) }} aria-hidden="true">
        {bars.map((b) => (
          <li
            key={b.date}
            className="flex flex-1 items-end justify-center gap-[2px]"
            title={`${day(b.date)}: ${b.count} ${b.count === 1 ? "exam" : "exams"}${cards ? ` · ${sessions(b.flashcards)}` : ""}`}
          >
            <span className="flex flex-1 flex-col items-center justify-end" style={{ maxWidth: sm ? 26 : 56 }}>
              <span className={`${sm ? "text-[11px]" : "text-[14px]"} font-semibold text-ink-muted`}>{b.count}</span>
              <span className={`mt-1 w-full rounded-t-[4px] ${b.isToday ? "bg-brand" : "bg-[#A9C4FF]"}`} style={{ height: height(b.count) }} />
            </span>
            {cards && (
              <span className="flex flex-col items-center justify-end" style={{ width: sm ? 10 : 20 }}>
                {b.flashcards > 0 && <span className={`${sm ? "text-[10px]" : "text-[12px]"} font-semibold text-ink-muted`}>{b.flashcards}</span>}
                <span className="mt-1 w-full rounded-t-[4px]" style={{ height: height(b.flashcards), background: CARDS }} />
              </span>
            )}
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
