import type { Metadata } from "next";
import Link from "next/link";
import { ExamLink } from "@/components/exam/ExamLink";
import { TopicStrength } from "@/components/TrackBars";
import { formatTestDate } from "@/domain/tracks";
import { completedToday } from "@/domain/suggestions";
import { inSentence } from "@/domain/examMix";
import { learnerWords } from "@/domain/trackView";
import { TrackEdge, TrackTag } from "@/components/TrackTag";
import { trackCompletion } from "@/domain/goals";
import { requireShell } from "@/server/auth/current";
import { getStudentDashboard, recentExams, type RecentExam, type StudentTrack } from "@/server/exams";
import { examScores, examSpans, examTopicLines, practiceTimes } from "@/server/results";
import { dailyWritingTime, examWritingTime, formatDuration } from "@/domain/activity";
import { todayIn } from "@/domain/tracks";
import { ExamScoresChart } from "@/components/charts/ExamScoresChart";
import { ActivityCharts } from "@/components/charts/ActivityCharts";
import { PractiseButton } from "@/components/flashcards/Practise";
import { RefreshWhileWaiting } from "@/components/RefreshWhileWaiting";
import { Preparing } from "@/components/Preparing";
import { PRACTISE_STATUSES } from "@/domain/flashcards";
import { deckCounts, flashcardActivity, type DeckCount } from "@/server/flashcards";

export const metadata: Metadata = { title: "Today · owlrnd" };
export const dynamic = "force-dynamic";

type Tab = "today" | "recent" | "tracks";
const TABS: [Tab, string][] = [
  ["today", "Today"],
  ["recent", "Past exams"],
  ["tracks", "All tracks"],
];

// 3c Today, 3d Recent exams, 3e All tracks; 3f first day and 3g nothing to practise. The activity charts show from
// the first day (owner, 2026-11-18), once the learner has a track; Recent exams opens with the overall scores chart.
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ tab?: string; track?: string }> }) {
  const { user: { student } } = await requireShell("learner");
  const { tab: raw, track: trackFilter } = await searchParams;
  const tab: Tab = raw === "recent" || raw === "tracks" ? raw : "today";
  const dash = await getStudentDashboard(student.id);
  const tz = student.timeZone;
  const dateLine = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(new Date());
  const firstDay = dash.firstDay && dash.suggestions.length > 0;
  // Self-managed learners set up their own tracks; children are told their parent does (3c–3g, sm-3c–3g).
  const selfManaged = student.type === "self_managed";
  const w = learnerWords(selfManaged);
  // 0.3 flashcards (fc-1): the Practise button's count per track that can be practised.
  const decks = await deckCounts(dash.tracks.filter((t) => PRACTISE_STATUSES.includes(t.status)).map((t) => t.id));
  const cardTimes = (await flashcardActivity(student.id)).times;
  // A track's exam is being written: the page updates itself when it's ready.
  // Not while it's on hold: that waits hours (allowance, daily limit), so polling would only add load.
  const writing = dash.tracks.filter((t) => t.preparing && !t.hold);

  return (
    <>
      {writing.length > 0 && <RefreshWhileWaiting />}
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
          <>
            <FirstDay suggestion={dash.suggestions[0]!} w={w} deck={decks.get(dash.suggestions[0]!.id)} />
            <div className="mt-6 max-w-[900px]">
              <ActivityCharts times={await practiceTimes(student.id)} timeZone={tz} size="lg" flashcards={cardTimes} />
            </div>
          </>
        ) : tab === "today" ? (
          <>
            <Today suggestions={dash.suggestions} completed={dash.completed} tracks={dash.tracks} done={completedToday(dash.recent.map((r) => r.submittedAt), tz)} writingToday={dailyWritingTime(await examSpans(student.id), tz).get(todayIn(tz)) ?? 0} selfManaged={selfManaged} w={w} decks={decks} />
            <Completed tracks={dash.tracks} decks={decks} />
            {dash.tracks.length > 0 && (
              <div className="mt-6">
                <ActivityCharts times={await practiceTimes(student.id)} timeZone={tz} size="lg" flashcards={cardTimes} />
              </div>
            )}
          </>
        ) : tab === "recent" ? (
          <>
            <ExamScoresChart exams={await examScores(student.id)} timeZone={tz} />
            <PastExams studentId={student.id} tracks={dash.tracks} trackId={dash.tracks.some((t) => t.id === trackFilter) ? trackFilter : undefined} tz={tz} />
          </>
        ) : (
          <AllTracks tracks={dash.tracks} w={w} decks={decks} />
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
    <ExamLink href={`/exam/${t.exam!.id}`} className={`${primary ? "btn-primary" : "btn-outline border-brand text-brand"} h-[52px] w-full text-base`} aria-label={`${label} exam ${t.exam!.number}: ${t.name}`}>
      {label}
    </ExamLink>
  );
}

type Words = ReturnType<typeof learnerWords>;

function FirstDay({ suggestion: t, w, deck }: { suggestion: StudentTrack; w: Words; deck: DeckCount | undefined }) {
  return (
    <div className="grid max-w-[900px] gap-5 md:grid-cols-[1.2fr_1fr]">
      <section className="card relative overflow-hidden">
        <TrackEdge colorIndex={t.colorIndex} completion={completionOf(t)} />
        <p className="text-ink-muted">
          {w.firstTrackReady} Your first exam is ready: {t.exam?.questionCount ?? 10} questions, about 10 minutes.
        </p>
        <div className="mt-5">
          <TrackTag name={t.name} colorIndex={t.colorIndex} />
        </div>
        <p className="mt-3 text-sm text-ink-muted">Exam {t.exam!.number} in this track</p>
        <h2 className="text-2xl">{t.name}</h2>
        <p className="mt-1 text-ink-muted">{examLine(t)}</p>
        <div className="mt-5 flex max-w-[260px] flex-col gap-2.5">
          <StartLink t={t} primary />
          <PractiseButton trackId={t.id} trackName={t.name} deck={deck} className="h-[52px] w-full px-3 text-base" />
        </div>
      </section>
      <section className="card bg-transparent">
        <h2 className="text-lg">How it works</h2>
        <p className="mt-2 text-ink-muted">
          Each exam is built from your last result, with more questions on what you find hard. You earn points for every exam, and your practice activity
          builds up below as you go.
        </p>
      </section>
    </div>
  );
}

function Today({
  suggestions,
  completed,
  tracks,
  done,
  writingToday,
  selfManaged,
  w,
  decks,
}: {
  decks: Map<string, DeckCount>;
  suggestions: StudentTrack[];
  /** Exams the learner has finished on owlrnd, all tracks. */
  completed: number;
  tracks: StudentTrack[];
  done: number;
  /** Milliseconds spent writing exams today, start to submit (owner, 2026-11-22). */
  writingToday: number;
  selfManaged: boolean;
  w: Words;
}) {
  if (tracks.length === 0) {
    return (
      <section className="card max-w-xl">
        <h2 className="text-xl">No tracks yet</h2>
        <p className="mt-1 text-ink-muted">{w.noTracks}</p>
        {selfManaged && (
          <Link href="/tracks/setup" className="btn-primary mt-4 h-12 px-5">
            Set up your first track
          </Link>
        )}
      </section>
    );
  }
  if (suggestions.length === 0) return <CaughtUp tracks={tracks} selfManaged={selfManaged} w={w} decks={decks} />;
  return (
    <section aria-labelledby="suggested">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="suggested" className="text-xl">
          Suggested practice exams
        </h2>
        {completed > 0 && (
          <p className="flex items-center gap-1.5 text-[15px] font-semibold text-ink-muted">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.6">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
            {/* The total on owlrnd (owner, 2026-11-16), with today's count when there is one. */}
            {completed} {completed === 1 ? "exam" : "exams"} completed{done > 0 ? ` · ${done} today · ${formatDuration(writingToday)} writing` : ""}
          </p>
        )}
      </div>
      <ol className="grid gap-4 md:grid-cols-3">
        {suggestions.map((t, i) => (
          <li key={t.id} className="card relative flex flex-col overflow-hidden">
            <TrackEdge colorIndex={t.colorIndex} completion={completionOf(t)} />
            <div>
              <TrackTag name={t.name} colorIndex={t.colorIndex} />
            </div>
            <p className="mt-4 text-sm text-ink-muted">Exam {t.exam!.number} in this track</p>
            <h3 className="text-[21px] leading-snug">{t.name}</h3>
            <p className="mb-5 mt-1 text-ink-muted">{examLine(t)}</p>
            <div className="mt-auto flex flex-col gap-2.5">
              <StartLink t={t} primary={i === 0} />
              <PractiseButton trackId={t.id} trackName={t.name} deck={decks.get(t.id)} className="h-[52px] w-full px-3 text-base" />
            </div>
          </li>
        ))}
        {tracks
          .filter((t) => t.preparing)
          .map((t) => (
            <li key={t.id} className="card relative flex flex-col overflow-hidden border-dashed">
              <TrackEdge colorIndex={t.colorIndex} completion={completionOf(t)} />
              <div>
                <TrackTag name={t.name} colorIndex={t.colorIndex} />
              </div>
              <p className="mt-4 text-sm text-ink-muted">Exam {t.examsTaken + 1} in this track</p>
              <h3 className="text-[21px] leading-snug">{t.name}</h3>
              <Preparing className="mt-auto pt-5" label="Exam being prepared" note="Usually ready within a minute. It appears here by itself." hold={t.hold} viewer={selfManaged ? "holder" : "child"} />
            </li>
          ))}
      </ol>
      <p className="mt-4 text-ink-muted">
        When you finish one, a new suggestion takes its place. Do as many as you like.
        {suggestions.some((t) => decks.get(t.id)?.practise) && " Flashcards are quick practice: no marks, no effect on your goal."}
      </p>
    </section>
  );
}

const statusOf = (t: StudentTrack, w: Words) =>
  t.status === "paused" ? w.paused : t.status === "goal_reached" ? "Goal reached" : t.exam ? "Exam ready" : t.hold ? "Your next exam is on hold" : "Your next exam is being prepared";

function CaughtUp({ tracks, selfManaged, w, decks }: { tracks: StudentTrack[]; selfManaged: boolean; w: Words; decks: Map<string, DeckCount> }) {
  // A new track whose first exam isn't written yet: say so, rather than "all caught up".
  const firstWriting = tracks.find((t) => t.preparing && t.examsTaken === 0);
  // Goal-reached tracks are listed under Completed instead (owner, 2026-11-25).
  const running = tracks.filter((t) => t.status !== "goal_reached");
  return (
    <section className="grid max-w-[900px] gap-5 md:grid-cols-[1.2fr_1fr]">
      <div className="card">
        {firstWriting ? (
          <>
            <div className="mb-3">
              <TrackTag name={firstWriting.name} colorIndex={firstWriting.colorIndex} />
            </div>
            <h2 className="text-2xl">Your first exam is {firstWriting.hold ? "on hold" : "being prepared"}</h2>
            <Preparing
              className="mt-3"
              label={firstWriting.name}
              note="It usually takes under a minute. This page updates by itself when it's ready."
              hold={firstWriting.hold}
              viewer={selfManaged ? "holder" : "child"}
            />
          </>
        ) : (
          <>
            <h2 className="text-2xl">You are all caught up</h2>
            <p className="mt-2 text-ink-muted">
              There are no exams to suggest right now.{" "}
              {tracks.some((t) => t.status !== "active") ? w.caughtUp : "Your next exam will appear here when it is ready."}
            </p>
          </>
        )}
        {/* sm-3g: the learner can act on it straight away. */}
        {selfManaged && (
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/tracks" className="btn-outline h-11 px-4">
              Your tracks
            </Link>
            <Link href="/tracks/new" className="btn-primary h-11 px-4">
              New track
            </Link>
          </div>
        )}
      </div>
      {running.length > 0 && (
        <div className="card bg-transparent">
          <h2 className="mb-3 text-lg">Your tracks</h2>
          <ul className="divide-y divide-line">
            {running.map((t) => (
              <li key={t.id} className="py-2.5">
                {t.preparing ? (
                  <Preparing label={t.name} note="Exam being prepared…" hold={t.hold} viewer={selfManaged ? "holder" : "child"} />
                ) : (
                  <>
                    <p className="font-semibold">{t.name}</p>
                    <p className="text-sm text-ink-muted">{statusOf(t, w)}</p>
                  </>
                )}
                {/* Nothing to take, but the deck can still be practised (fc-5: also on finished tracks). */}
                <PractiseButton trackId={t.id} trackName={t.name} deck={decks.get(t.id)} className="mt-2 h-11 px-4 text-[15px]" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Past exams to list at most (newest first); far more than a learner takes in a term. */
const PAST_EXAMS_LIMIT = 300;

// 3d: every exam the learner has finished, newest first, optionally one track's, each with its result and marked
// paper (owner, 2026-11-18: learners look back at how each exam was marked).
async function PastExams({ studentId, tracks, trackId, tz }: { studentId: string; tracks: StudentTrack[]; trackId?: string; tz: string }) {
  const recent = await recentExams(studentId, PAST_EXAMS_LIMIT, trackId);
  const writingTimes = new Map((await examSpans(studentId, recent.map((r) => r.id))).map((s) => [s.id!, examWritingTime(s)]));
  const lines = await examTopicLines(recent.filter((r) => r.status === "marked").map((r) => r.id));
  const chip = (active: boolean) =>
    `flex min-h-touch items-center rounded border px-3 text-[15px] font-semibold ${active ? "border-brand bg-brand text-white" : "border-line bg-card text-ink hover:border-brand"}`;
  return (
    <>
      {tracks.length > 1 && (
        <nav aria-label="Show exams from" className="mb-5 mt-8 flex flex-wrap gap-2">
          <Link href="/today?tab=recent" className={chip(!trackId)} aria-current={!trackId ? "page" : undefined}>
            All tracks
          </Link>
          {tracks.map((t) => (
            <Link key={t.id} href={`/today?tab=recent&track=${t.id}`} className={chip(trackId === t.id)} aria-current={trackId === t.id ? "page" : undefined}>
              {t.name}
            </Link>
          ))}
        </nav>
      )}
      <Recent recent={recent} tz={tz} lines={lines} writingTimes={writingTimes} />
    </>
  );
}

function Recent({ recent, tz, lines, writingTimes }: { recent: RecentExam[]; tz: string; lines: Map<string, { strong: string[]; needsWork: string[] }>; writingTimes: Map<string, number> }) {
  if (!recent.length) return <p className="mt-8 text-ink-muted">Exams you finish show here.</p>;
  const day = (d: Date) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: tz }).format(d).replace(",", "");
  const todayLabel = day(new Date());
  const groups = new Map<string, RecentExam[]>();
  for (const r of recent) groups.set(day(r.submittedAt), [...(groups.get(day(r.submittedAt)) ?? []), r]);
  // Time spent writing the day's listed exams, start to submit, idle gaps capped (owner, 2026-11-22, 2026-11-24).
  const writing = (rows: RecentExam[]) => rows.reduce((a, r) => a + (writingTimes.get(r.id) ?? 0), 0);
  return (
    <section aria-labelledby="recent-h">
      <h2 id="recent-h" className="mb-4 text-xl">
        Your past exams
      </h2>
      <p className="-mt-2 mb-4 text-ink-muted">Open any exam to see its result, or the marked paper with every answer and why.</p>
      <div className="flex flex-col gap-6">
        {[...groups].map(([label, rows]) => (
          <div key={label}>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">{label === todayLabel ? `Today · ${label}` : label}</h3>
              {rows.some((r) => r.startedAt) && (
                <p className="text-sm text-ink-muted">
                  {rows.length} {rows.length === 1 ? "exam" : "exams"} · {formatDuration(writing(rows))} writing
                </p>
              )}
            </div>
            <ul className="divide-y divide-line rounded border border-line bg-card">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-5 gap-y-1 px-5 py-4">
                  <span className={`w-[70px] shrink-0 text-xl font-semibold ${r.score === null ? "text-ink-muted" : ""}`}>{r.score === null ? "—" : `${r.score} / 10`}</span>
                  <span className="min-w-0 flex-1">
                    <span className="mb-1 flex flex-wrap items-center gap-2">
                      <TrackTag name={r.trackName} colorIndex={r.colorIndex} />
                      {r.overallNumber && <span className="text-sm font-semibold text-ink-muted">Your exam {r.overallNumber}</span>}
                    </span>
                    <span className="font-semibold">{r.trackName}</span> <span className="text-ink-muted">· Exam {r.number}</span>
                    {lines.get(r.id) && (
                      <span className="block text-sm text-ink-muted">
                        {lines.get(r.id)!.strong.length > 0 && (
                          <>
                            Right: <span className="text-ink">{lines.get(r.id)!.strong.map(inSentence).join(", ")}</span>
                            {lines.get(r.id)!.needsWork.length > 0 && " · "}
                          </>
                        )}
                        {lines.get(r.id)!.needsWork.length > 0 && (
                          <>
                            Missed: <span className="text-ink">{lines.get(r.id)!.needsWork.map(inSentence).join(", ")}</span>
                          </>
                        )}
                      </span>
                    )}
                  </span>
                  {r.status === "marked" ? (
                    <span className="flex items-center gap-4">
                      <Link href={`/exam/${r.id}/result`} className="link flex min-h-touch items-center text-sm font-semibold" aria-label={`Result of ${r.trackName}, exam ${r.number}`}>
                        Result
                      </Link>
                      <a
                        href={`/exam/${r.id}/marked?from=past`}
                        className="link flex min-h-touch items-center text-sm font-semibold"
                        aria-label={`Marked paper of ${r.trackName}, exam ${r.number}`}
                      >
                        Marked paper
                      </a>
                    </span>
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

function AllTracks({ tracks, w, decks }: { tracks: StudentTrack[]; w: Words; decks: Map<string, DeckCount> }) {
  const ready = tracks.filter((t) => t.status === "active" && t.exam);
  // Goal-reached tracks move to Completed at the bottom (owner, 2026-11-25).
  const running = tracks.filter((t) => t.status !== "goal_reached");
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
                <ExamLink href={`/exam/${t.exam!.id}`} className="btn-outline border-brand px-6 text-brand" aria-label={`${t.exam!.status === "in_progress" ? "Continue" : "Start"} ${t.name}`}>
                  {t.exam!.status === "in_progress" ? "Continue" : "Start"}
                </ExamLink>
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
        {running.some((t) => t.topics.some((x) => x.strength === "needs_work")) ? (
          <ul className="divide-y divide-line rounded border border-line bg-card">
            {running.flatMap((t) =>
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
        {running.length > 0 ? (
          <ul className="grid gap-4 md:grid-cols-2">
            {running.map((t) => (
              <li key={t.id}>
                <Link href="/tracks" className="card block hover:border-brand">
                  <span className="block font-semibold">{t.name}</span>
                  <span className="mb-3 block text-sm text-ink-muted">
                    {t.status === "paused"
                      ? w.paused
                      : `${t.examsTaken} ${t.examsTaken === 1 ? "exam" : "exams"}${t.scores.length ? ` · last score ${t.scores[t.scores.length - 1]} / 10` : ""}`}
                    {decks.get(t.id)?.due ? ` · ${decks.get(t.id)!.due} ${decks.get(t.id)!.due === 1 ? "flashcard" : "flashcards"} to practise` : ""}
                  </span>
                  <TopicStrength topics={t.topics} compact />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-muted">Every track has reached its goal.</p>
        )}
      </section>

      <Completed tracks={tracks} decks={decks} className="" />
    </div>
  );
}

/** Tracks that reached their goal, below the exams (owner, 2026-11-25). They stop until topics are added. */
function Completed({ tracks, decks, className = "mt-8" }: { tracks: StudentTrack[]; decks: Map<string, DeckCount>; className?: string }) {
  const done = tracks.filter((t) => t.status === "goal_reached");
  if (done.length === 0) return null;
  return (
    <section aria-labelledby="completed-h" className={className}>
      <h2 id="completed-h" className="mb-3 text-xl">
        Completed
      </h2>
      <ul className="divide-y divide-line rounded border border-line bg-card">
        {done.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3">
            <span className="flex-1">
              <span className="font-semibold">{t.name}</span>
              <span className="block text-sm text-ink-muted">
                Goal reached · {t.examsTaken} {t.examsTaken === 1 ? "exam" : "exams"}
                {t.scores.length ? ` · last score ${t.scores[t.scores.length - 1]} / 10` : ""}
              </span>
            </span>
            {t.examsTaken > 0 && (
              <Link href={`/today?tab=recent&track=${t.id}`} className="link flex min-h-touch items-center text-sm font-semibold" aria-label={`Past exams in ${t.name}`}>
                Past exams
              </Link>
            )}
            <PractiseButton trackId={t.id} trackName={t.name} deck={decks.get(t.id)} className="h-11 px-4 text-[15px]" />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** How far a track is towards its goal, for the card's left edge. */
const completionOf = (t: StudentTrack) =>
  trackCompletion({ progress: t.goalProgress, runLength: t.goalRunLength, topics: t.topics, reached: t.status === "goal_reached" });
