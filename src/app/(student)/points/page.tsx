import type { Metadata } from "next";
import { rules } from "@/config/rules";
import { levelProgress } from "@/domain/levels";
import { todaysBreakdown } from "@/domain/points";
import { todayIn } from "@/domain/tracks";
import { requireShell } from "@/server/auth/current";
import { pointsEventsOf } from "@/server/results";

export const metadata: Metadata = { title: "Points · owlrnd" };
export const dynamic = "force-dynamic";

const StarIcon = ({ className }: { className?: string }) => (
  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
  </svg>
);

// 4.3a (rules §8)
export default async function PointsPage() {
  const { user: { student } } = await requireShell("learner");
  const events = await pointsEventsOf(student.id);
  const total = events.reduce((s, e) => s + e.points, 0);
  const lp = levelProgress(total);
  const tz = student.timeZone;
  const today = todaysBreakdown(events, todayIn(tz), (d) => todayIn(tz, d));
  const p = rules.points;
  const how: [string, string][] = [
    ["Finish an exam", `${p.finishExam}`],
    ["Each correct answer", `${p.perCorrect}`],
    ["Each extra correct answer compared with your last exam in that track", `${p.perExtraCorrectVsLast}`],
    ["A weak topic becomes strong", `${p.weakTopicBecomesStrong}`],
    ["A perfect 10 out of 10", `${p.perfectBonus} extra`],
    ["First exam of the day, when you practised yesterday too", `${p.streak.firstExamOfDay}`],
    [`The same, from day ${p.streak.fromDay} of a streak`, `${p.streak.firstExamOfDayLong}`],
  ];

  return (
    <>
      <h1 className="text-[32px] leading-tight">Points</h1>

      <div className="mt-6 grid gap-4 md:grid-cols-[1.7fr_1fr]">
        <section className="rounded bg-sidebar p-6 text-white" aria-label="Your points">
          <p className="flex items-baseline gap-3">
            <span className="text-[56px] font-semibold leading-none">{total.toLocaleString("en-GB")}</span>
            <span className="text-xl font-semibold">points</span>
          </p>
          <p className="mt-3 text-[17px]">
            {lp.current ? `${lp.current} level` : "No level yet"}
            {lp.next ? ` · ${lp.next.pointsToGo.toLocaleString("en-GB")} points to ${lp.next.name}` : " · the top level"}
          </p>
          <div
            className="mt-4 h-2 rounded bg-white/25"
            role="progressbar"
            aria-label={lp.next ? `Progress to ${lp.next.name}` : "Top level reached"}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(lp.share * 100)}
          >
            <div className="h-2 rounded bg-white" style={{ width: `${lp.share * 100}%` }} />
          </div>
        </section>

        <section className="card" aria-labelledby="today-h" role="region">
          <div className="flex items-baseline justify-between">
            <h2 id="today-h" className="text-[13px] font-bold uppercase tracking-wider text-ink-muted">
              Earned today
            </h2>
            <span className="text-2xl font-semibold text-brand">+{today.total}</span>
          </div>
          {today.lines.length ? (
            <ul className="mt-2 divide-y divide-line border-b border-line">
              {today.lines.map((l) => (
                <li key={l.label} className="flex justify-between py-2 text-[15px]">
                  <span>{l.label}</span>
                  <span className="font-semibold">+{l.points}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-ink-muted">No exams yet today. Every exam you finish earns points.</p>
          )}
        </section>
      </div>

      <section className="mt-8" aria-labelledby="levels-h">
        <h2 id="levels-h" className="mb-3 text-[13px] font-bold uppercase tracking-wider text-ink-muted">
          Levels
        </h2>
        <ol className="card grid grid-cols-2 gap-6 sm:grid-cols-5">
          {p.levels.map((l) => {
            const earned = total >= l.at;
            const here = lp.current === l.name;
            return (
              <li key={l.name} className="flex flex-col items-center text-center" aria-current={here ? "step" : undefined}>
                <span
                  className={`flex h-14 w-14 items-center justify-center rounded-full ${
                    here ? "bg-sidebar text-white" : earned ? "bg-brand text-white" : "border-2 border-dashed border-line-input text-line-input"
                  }`}
                >
                  <StarIcon />
                </span>
                <span className={`mt-2 font-semibold ${earned ? "" : "text-ink-muted"}`}>{l.name}</span>
                <span className="text-sm text-ink-muted">{here ? "You are here" : earned ? "Earned" : `at ${l.at.toLocaleString("en-GB")}`}</span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mt-8" aria-labelledby="how-h">
        <h2 id="how-h" className="border-b border-ink pb-2 text-[13px] font-bold uppercase tracking-wider text-ink-muted">
          How you earn points
        </h2>
        <table className="w-full text-[15px]">
          <caption className="sr-only">How points are earned</caption>
          <tbody className="divide-y divide-line">
            {how.map(([what, pts]) => (
              <tr key={what}>
                <th scope="row" className="py-2 text-left font-normal">
                  {what}
                </th>
                <td className="py-2 text-right font-semibold">{pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[13px] text-ink-muted">
          Full points for your first {p.fullPointsExamsPerDay} exams each day. After that, only correct answers score. Points only add up; they are never spent
          or taken away.
        </p>
      </section>
    </>
  );
}
