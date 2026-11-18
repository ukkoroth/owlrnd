import { scoreSummary, type ScoredExam } from "@/domain/activity";
import { TrackTag } from "@/components/TrackTag";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const examWord = (n: number) => `${n} ${n === 1 ? "exam" : "exams"}`;

/**
 * The overall analysis on Recent exams (3d, owner 2026-11-18): every marked exam across all tracks as one series of
 * bars, score out of 10, oldest on the left. One colour (the exam blue): the track colours aren't safe to tell apart
 * as chart fills for colour-blind readers, so the track is named in each bar's tooltip and in the per-track list
 * below, which carries the track's labelled tag. The latest score is labelled; a table repeats it all for screen readers.
 */
export function ExamScoresChart({ exams, timeZone }: { exams: ScoredExam[]; timeZone: string }) {
  if (!exams.length) return null;
  const s = scoreSummary(exams);
  const h = 120;
  const date = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone }).format(d);
  const label = (e: ScoredExam) => (e.overallNumber ? `Your exam ${e.overallNumber}` : "Exam");
  const last = exams[exams.length - 1]!;

  return (
    <section className="card mb-8" aria-labelledby="scores-h">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="scores-h" className="text-[18px]">
          All your exams
        </h2>
        <p className="text-sm text-ink-muted">
          {examWord(s.count)} marked · average <span className="font-semibold text-ink">{fmt(s.average)} / 10</span>
          {s.recentAverage !== null && (
            <>
              {" "}
              · last 5 <span className="font-semibold text-ink">{fmt(s.recentAverage)} / 10</span>
            </>
          )}
        </p>
      </div>

      <figure>
        <figcaption className="sr-only">Score out of 10 for each marked exam, oldest first. The same scores are in the table below.</figcaption>
        <div className="flex gap-2" aria-hidden="true">
          <div className="relative w-5 shrink-0 text-right text-[12px] text-ink-muted" style={{ height: h }}>
            <span className="absolute right-0 top-0 -translate-y-1/2">10</span>
            <span className="absolute right-0 top-1/2 -translate-y-1/2">5</span>
            <span className="absolute bottom-0 right-0 translate-y-1/2">0</span>
          </div>
          <div className="relative flex-1">
            <span className="absolute inset-x-0 top-0 border-t border-dashed border-line" />
            <span className="absolute inset-x-0 top-1/2 border-t border-dashed border-line" />
            <ol className="relative flex items-end gap-[2px] border-b border-ink" style={{ height: h }}>
              {exams.map((e) => (
                <li key={e.id} className="group relative flex h-full flex-1 items-end justify-center" style={{ maxWidth: 40 }}>
                  {e === last && <span className="absolute text-[13px] font-semibold text-ink" style={{ bottom: Math.max(4, (e.score / 10) * h) + 2 }}>{e.score}</span>}
                  <span className="w-full rounded-t-[4px] bg-brand group-hover:opacity-80" style={{ height: e.score ? Math.max(4, (e.score / 10) * h) : 2 }} />
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink px-2 py-1 text-[12px] text-white group-hover:block">
                    {label(e)} · {e.trackName} · {e.score} / 10 · {date(e.submittedAt)}
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-1.5 flex justify-between text-[12px] text-ink-muted">
              <span>{label(exams[0]!)}</span>
              {exams.length > 1 && <span>{label(last)}</span>}
            </div>
          </div>
        </div>
      </figure>

      <ul className="mt-5 flex flex-col gap-3">
        {s.tracks.map((t) => (
          <li key={t.trackId} className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="min-w-0 flex-1">
              <TrackTag name={t.trackName} colorIndex={t.colorIndex} />
              <span className="ml-2 text-sm text-ink-muted">{examWord(t.count)}</span>
            </span>
            <span className="flex items-center gap-3 text-sm">
              <span className="hidden h-2 w-24 overflow-hidden rounded-full bg-line sm:block" aria-hidden="true">
                <span className="block h-full rounded-full bg-brand" style={{ width: `${t.average * 10}%` }} />
              </span>
              <span>
                average <span className="font-semibold">{fmt(t.average)}</span> · latest <span className="font-semibold">{t.latest} / 10</span>
              </span>
            </span>
          </li>
        ))}
      </ul>

      <table className="sr-only">
        <caption>Marked exams, oldest first</caption>
        <thead>
          <tr>
            <th scope="col">Exam</th>
            <th scope="col">Track</th>
            <th scope="col">Date</th>
            <th scope="col">Score out of 10</th>
          </tr>
        </thead>
        <tbody>
          {exams.map((e) => (
            <tr key={e.id}>
              <td>{label(e)}</td>
              <td>{e.trackName}</td>
              <td>{date(e.submittedAt)}</td>
              <td>{e.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
