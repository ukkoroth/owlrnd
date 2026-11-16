import type { Metadata } from "next";
import Link from "next/link";
import { TopicStrength } from "@/components/TrackBars";
import { formatTestDate } from "@/domain/tracks";
import { completedToday } from "@/domain/suggestions";
import { inSentence } from "@/domain/examMix";
import { requireShell } from "@/server/auth/current";
import { getStudentDashboard, type RecentExam, type StudentTrack } from "@/server/exams";
import { examTopicLines, practiceTimes } from "@/server/results";
import { ActivityCharts } from "@/components/charts/ActivityCharts";

export const metadata: Metadata = { title: "Today · owlrnd" };
export const dynamic = "force-dynamic";

type Tab = "today" | "recent" | "tracks";
const TABS: [Tab, string][] = [
  ["today", "Today"],
  ["recent", "Recent exams"],
  ["tracks", "All tracks"],
];

// 3c Today, 3d Recent exams, 3e All tracks; 3f first day and 3g nothing to practise. Charts come in M6.
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { user: { student } } = await requireShell("learner");
  const { tab: raw } = await searchParams;
  const tab: Tab = raw === "recent" || raw === "tracks" ? raw : "today";
  const dash = await getStudentDashboard(student.id);
  const tz = student.timeZone;
  const dateLine = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(new Date());
  const firstDay = dash.firstDay && dash.suggestions.length > 0;

  return (
    <>
      <p className="text-sm text-ink-muted">{dateLine}</p>
      <h1 className="text-[32px] leading-tight">{firstDay ? `Welcome, ${student.name}` : `Hi ${student.name}`}</h1>

      {!firstDay && (
        <nav aria-label="Dashboard" className="mt-7 flex gap-8 border-b border-line">
          {TABS.map(([key, label]) => (
            <Link
              key={key}
              href={key === "today" ? "/today" : `/today?tab=${key}`}
              aria-current={tab === key ? "page" : undefined}
              className={`-mb-px flex min-h-touch items-center border-b-[3px] px-1 text-[16px] font-semibold ${
                tab === key ? "border-brand text-ink" : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      )}

      <div className="mt-8">
        {firstDay ? (
          <FirstDay suggestion={dash.suggestions[0]!} />
        ) : tab === "today" ? (
          <>
            <Today suggestions={dash.suggestions} tracks={dash.tracks} done={completedToday(dash.recent.map((r) => r.submittedAt), tz)} />
            {dash.recent.length > 0 && (
              <div className="mt-6">
                <ActivityCharts times={await practiceTimes(student.id)} timeZone={tz} size="lg" />
              </div>
            )}
          </>
        ) : tab === "recent" ? (
          <Recent recent={dash.recent} tz={tz} lines={await examTopicLines(dash.recent.filter((r) => r.status === "marked").map((r) => r.id))} />
        ) : (
          <AllTracks tracks={dash.tracks} />
        )}
      </div>
    </>
  );
}

const examLine = (t: StudentTrack) =>
  `${t.exam?.questionCount ?? 10} questions${t.testDate ? ` · ${t.testLabel ?? "test"} on ${formatTestDate(t.testDate)}` : ""}`;

function StartLink({ t, primary }: { t: StudentTrack; primary: boolean }) {
  const label = t.exam?.status === "in_progress" ? "Continue" : "Start";
  return (
    <Link href={`/exam/${t.exam!.id}`} className={`${primary ? "btn-primary" : "btn-outline border-brand text-brand"} h-[52px] w-full text-base`} aria-label={`${label} exam ${t.exam!.number}: ${t.name}`}>
      {label}
    </Link>
  );
}

function FirstDay({ suggestion: t }: { suggestion: StudentTrack }) {
  return (
    <div className="grid max-w-[900px] gap-5 md:grid-cols-[1.2fr_1fr]">
      <section className="card">
        <p className="text-ink-muted">
          Your parent has set up your first track. Your first exam is ready: {t.exam?.questionCount ?? 10} questions, about 10 minutes.
        </p>
        <p className="mt-5 text-sm text-ink-muted">Exam {t.exam!.number}</p>
        <h2 className="text-2xl">{t.name}</h2>
        <p className="mt-1 text-ink-muted">{examLine(t)}</p>
        <div className="mt-5 max-w-[260px]">
          <StartLink t={t} primary />
        </div>
      </section>
      <section className="card bg-transparent">
        <h2 className="text-lg">How it works</h2>
        <p className="mt-2 text-ink-muted">
          Each exam is built from your last result, with more questions on what you find hard. You earn points for every exam, and your practice activity
          shows here after your first one.
        </p>
      </section>
    </div>
  );
}

function Today({ suggestions, tracks, done }: { suggestions: StudentTrack[]; tracks: StudentTrack[]; done: number }) {
  if (tracks.length === 0) {
    return (
      <section className="card max-w-xl">
        <h2 className="text-xl">No tracks yet</h2>
        <p className="mt-1 text-ink-muted">Your parent sets up what you practise. Your first exam will appear here as soon as they do.</p>
      </section>
    );
  }
  if (suggestions.length === 0) return <CaughtUp tracks={tracks} />;
  return (
    <section aria-labelledby="suggested">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="suggested" className="text-xl">
          Suggested practice exams
        </h2>
        {done > 0 && (
          <p className="flex items-center gap-1.5 text-[15px] font-semibold text-ink-muted">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.6">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
            {done} completed today
          </p>
        )}
      </div>
      <ol className="grid gap-4 md:grid-cols-3">
        {suggestions.map((t, i) => (
          <li key={t.id} className="card flex flex-col">
            <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-pale text-lg font-semibold text-sidebar">
              {i + 1}
            </span>
            <p className="mt-5 text-sm text-ink-muted">Exam {t.exam!.number}</p>
            <h3 className="text-[21px] leading-snug">{t.name}</h3>
            <p className="mb-5 mt-1 text-ink-muted">{examLine(t)}</p>
            <div className="mt-auto">
              <StartLink t={t} primary={i === 0} />
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-ink-muted">When you finish one, a new suggestion takes its place. Do as many as you like.</p>
    </section>
  );
}

const statusOf = (t: StudentTrack) =>
  t.status === "paused" ? "Paused by your parent" : t.status === "goal_reached" ? "Goal reached" : t.exam ? "Exam ready" : "Your next exam is being prepared";

function CaughtUp({ tracks }: { tracks: StudentTrack[] }) {
  return (
    <section className="grid max-w-[900px] gap-5 md:grid-cols-[1.2fr_1fr]">
      <div className="card">
        <h2 className="text-2xl">You are all caught up</h2>
        <p className="mt-2 text-ink-muted">
          There are no exams to suggest right now.{" "}
          {tracks.some((t) => t.status !== "active") ? "Your parent can add new topics or resume a track to start it again." : "Your next exam will appear here when it is ready."}
        </p>
      </div>
      <div className="card bg-transparent">
        <h2 className="mb-3 text-lg">Your tracks</h2>
        <ul className="divide-y divide-line">
          {tracks.map((t) => (
            <li key={t.id} className="py-2.5">
              <p className="font-semibold">{t.name}</p>
              <p className="text-sm text-ink-muted">{statusOf(t)}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Recent({ recent, tz, lines }: { recent: RecentExam[]; tz: string; lines: Map<string, { strong: string[]; needsWork: string[] }> }) {
  if (!recent.length) return <p className="text-ink-muted">Exams you finish show here.</p>;
  const day = (d: Date) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: tz }).format(d).replace(",", "");
  const todayLabel = day(new Date());
  const groups = new Map<string, RecentExam[]>();
  for (const r of recent) groups.set(day(r.submittedAt), [...(groups.get(day(r.submittedAt)) ?? []), r]);
  return (
    <section aria-labelledby="recent-h">
      <h2 id="recent-h" className="mb-4 text-xl">
        Exams you practised recently
      </h2>
      <div className="flex flex-col gap-6">
        {[...groups].map(([label, rows]) => (
          <div key={label}>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-muted">{label === todayLabel ? `Today · ${label}` : label}</h3>
            <ul className="divide-y divide-line rounded border border-line bg-card">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-5 gap-y-1 px-5 py-4">
                  <span className={`w-[70px] shrink-0 text-xl font-semibold ${r.score === null ? "text-ink-muted" : ""}`}>{r.score === null ? "—" : `${r.score} / 10`}</span>
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold">{r.trackName}</span> <span className="text-ink-muted">· Exam {r.number}</span>
                    {lines.get(r.id) && (
                      <span className="block text-sm text-ink-muted">
                        {lines.get(r.id)!.strong.length > 0 && (
                          <>
                            Strong: <span className="text-ink">{lines.get(r.id)!.strong.map(inSentence).join(", ")}</span>
                            {lines.get(r.id)!.needsWork.length > 0 && " · "}
                          </>
                        )}
                        {lines.get(r.id)!.needsWork.length > 0 && (
                          <>
                            Needs work: <span className="text-ink">{lines.get(r.id)!.needsWork.map(inSentence).join(", ")}</span>
                          </>
                        )}
                      </span>
                    )}
                  </span>
                  {r.status === "marked" ? (
                    <Link href={`/exam/${r.id}/result`} className="link flex min-h-touch items-center text-sm font-semibold" aria-label={`Result of ${r.trackName}, exam ${r.number}`}>
                      Result
                    </Link>
                  ) : (
                    <span className="text-sm text-ink-muted">Marking…</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function AllTracks({ tracks }: { tracks: StudentTrack[] }) {
  const ready = tracks.filter((t) => t.status === "active" && t.exam);
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="ready-h">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="ready-h" className="text-xl">
            Exams ready to take
          </h2>
          <span className="text-sm text-ink-muted">
            in {ready.length} {ready.length === 1 ? "track" : "tracks"}
          </span>
        </div>
        {ready.length ? (
          <ul className="divide-y divide-line rounded border border-line bg-card">
            {ready.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-4 px-5 py-3">
                <span className="flex-1">
                  <span className="font-semibold">{t.name}</span>
                  <span className="block text-sm text-ink-muted">
                    Exam {t.exam!.number}
                    {t.testDate ? ` · ${t.testLabel ?? "test"} on ${formatTestDate(t.testDate)}` : ""}
                  </span>
                </span>
                <Link href={`/exam/${t.exam!.id}`} className="btn-outline border-brand px-6 text-brand" aria-label={`${t.exam!.status === "in_progress" ? "Continue" : "Start"} ${t.name}`}>
                  {t.exam!.status === "in_progress" ? "Continue" : "Start"}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-muted">No exams waiting right now.</p>
        )}
      </section>

      <section aria-labelledby="work-h">
        <h2 id="work-h" className="mb-3 text-xl">
          Needs work
        </h2>
        {tracks.some((t) => t.topics.some((x) => x.strength === "needs_work")) ? (
          <ul className="divide-y divide-line rounded border border-line bg-card">
            {tracks.flatMap((t) =>
              t.topics
                .filter((x) => x.strength === "needs_work")
                .map((x) => (
                  <li key={`${t.id}-${x.id}`} className="flex flex-wrap justify-between gap-2 px-5 py-3">
                    <span className="font-semibold">{x.name}</span>
                    <span className="text-sm text-ink-muted">{t.name}</span>
                  </li>
                )),
            )}
          </ul>
        ) : (
          <p className="text-ink-muted">Topics that need more practice show here after your first marked exam.</p>
        )}
      </section>

      <section aria-labelledby="tracks-h">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="tracks-h" className="text-xl">
            Your tracks
          </h2>
          <Link href="/tracks" className="link text-sm font-semibold">
            See all {tracks.length} {tracks.length === 1 ? "track" : "tracks"}
          </Link>
        </div>
        <ul className="grid gap-4 md:grid-cols-2">
          {tracks.map((t) => (
            <li key={t.id}>
              <Link href="/tracks" className="card block hover:border-brand">
                <span className="block font-semibold">{t.name}</span>
                <span className="mb-3 block text-sm text-ink-muted">
                  {t.status === "paused"
                    ? "Paused by your parent"
                    : `${t.examsTaken} ${t.examsTaken === 1 ? "exam" : "exams"}${t.scores.length ? ` · last score ${t.scores[t.scores.length - 1]} / 10` : ""}`}
                </span>
                <TopicStrength topics={t.topics} compact />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
