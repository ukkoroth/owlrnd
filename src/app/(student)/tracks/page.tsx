import type { Metadata } from "next";
import Link from "next/link";
import { ExamLink } from "@/components/exam/ExamLink";
import { PageHeader } from "@/components/PageHeader";
import { GoalProgress, NeedsWork, ScoreBars, StrengthLegend, TopicStrength } from "@/components/TrackBars";
import { formatTestDate } from "@/domain/tracks";
import { TracksOverview } from "@/components/tracks/TracksOverview";
import { requireShell } from "@/server/auth/current";
import { getStudentTracks, type StudentTrack } from "@/server/exams";
import { getDraftChat, listTracks } from "@/server/tracks";
import { PRACTISE_STATUSES } from "@/domain/flashcards";
import { deckCounts } from "@/server/flashcards";
import { DeckLine, PractiseButton } from "@/components/flashcards/Practise";
import { Preparing } from "@/components/Preparing";
import { RefreshWhileWaiting } from "@/components/RefreshWhileWaiting";

export const metadata: Metadata = { title: "Your tracks · owlrnd" };
export const dynamic = "force-dynamic";

const statusLine = (t: StudentTrack) => {
  if (t.status === "paused") return "Paused by your parent";
  if (t.status === "goal_reached") return "Goal reached. Well done!";
  const test = t.testDate ? ` · ${t.testLabel ?? "test"} on ${formatTestDate(t.testDate)}` : "";
  return (t.exam ? (t.exam.status === "in_progress" ? "Exam in progress" : "Next exam ready") : "Next exam being prepared") + test;
};

// 4.1a. A self-managed learner practises and manages here (sm-4.1a); a child whose parent manages their tracks
// sees them read-only.
export default async function YourTracksPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  const { user: { student }, actor } = await requireShell("learner");
  if (student.type === "self_managed") {
    const tracks = (await listTracks(actor, student.id)) ?? [];
    const decks = await deckCounts(tracks.filter((t) => PRACTISE_STATUSES.includes(t.status)).map((t) => t.id));
    const draft = (await getDraftChat(actor, student.id))?.draft;
    const { created } = await searchParams;
    return (
      <>
        {tracks.some((t) => t.status === "active" && !t.readyExam && t.nextExam !== "failed" && !t.nextExamHold) && <RefreshWhileWaiting />}
        <TracksOverview audience={{ kind: "learner" }} studentId={student.id} list={tracks} hasDraft={!!draft} created={!!created} timeZone={student.timeZone} decks={decks} />
        {tracks.length > 0 && (
          <div className="mt-3">
            <StrengthLegend />
          </div>
        )}
      </>
    );
  }
  const list = await getStudentTracks(student.id);
  const decks = await deckCounts(list.filter((t) => PRACTISE_STATUSES.includes(t.status)).map((t) => t.id));

  return (
    <>
      {list.some((t) => t.preparing && !t.hold) && <RefreshWhileWaiting />}
      <PageHeader title="Your tracks" subtitle="Each new exam is built from your last result in that track." />
      {list.length === 0 ? (
        <p className="text-ink-muted">Your parent hasn&apos;t set up a track yet.</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((t) => (
            <li key={t.id} className={`card flex flex-col ${t.status === "goal_reached" ? "border-2 border-brand" : ""}`}>
              <p className={`text-sm ${t.status === "goal_reached" ? "font-semibold text-brand" : "text-ink-muted"}`}>{statusLine(t)}</p>
              <h2 className="text-[21px] leading-snug">{t.name}</h2>
              <div className="mb-4 mt-3 flex items-end justify-between gap-3">
                <ScoreBars scores={t.scores} />
                <span className="ml-auto text-sm text-ink-muted">
                  {t.examsTaken} {t.examsTaken === 1 ? "exam" : "exams"} taken
                </span>
              </div>
              <TopicStrength topics={t.topics} />
              <div className="mt-3">
                <NeedsWork topics={t.topics} />
              </div>
              <div className="mt-4">
                <GoalProgress threshold={t.goalThreshold} runLength={t.goalRunLength} progress={t.goalProgress} reached={t.status === "goal_reached"} topics={t.topics} />
              </div>
              <DeckLine deck={decks.get(t.id)} timeZone={student.timeZone} reached={t.status === "goal_reached"} />
              <div className="mt-auto flex flex-col gap-2.5 border-t border-line pt-4">
                {t.status === "paused" ? (
                  <p className="text-ink-muted">No new exams while paused</p>
                ) : t.status === "goal_reached" ? (
                  <p className="text-ink-muted">Waiting for new topics from your parent</p>
                ) : t.exam ? (
                  <ExamLink href={`/exam/${t.exam.id}`} className="btn-primary">
                    {t.exam.status === "in_progress" ? "Continue" : "Start"} exam {t.exam.number}
                  </ExamLink>
                ) : (
                  <Preparing label={`${t.examsTaken === 0 ? "Your first exam" : `Exam ${t.examsTaken + 1}`} is being prepared…`} note="This page updates by itself when it's ready." hold={t.hold} viewer="child" />
                )}
                <PractiseButton trackId={t.id} trackName={t.name} deck={decks.get(t.id)} from="tracks" className="h-12 px-5" />
                {(decks.get(t.id)?.total ?? 0) > 0 && (
                  <Link href={`/tracks/${t.id}/flashcards`} className="link flex min-h-touch items-center self-start font-semibold" aria-label={`Flashcards in ${t.name}`}>
                    Flashcards
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {list.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
          <StrengthLegend />
          <p className="text-sm text-ink-muted">A track stops when its goal is reached, until your parent adds topics.</p>
        </div>
      )}
    </>
  );
}
