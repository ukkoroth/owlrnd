import { trackDays, trackDaysLabel, trackStatusLine } from "@/domain/tracks";
import { GoalProgress, NeedsWork, ScoreBars, TopicStrength } from "./TrackBars";
import type { TrackSummary } from "@/server/tracks";
import Link from "next/link";
import { ExamLink } from "@/components/exam/ExamLink";
import { pauseTrack, resumeTrack, retryExam } from "@/app/_actions/tracks";
import { ArchiveButton } from "./ArchiveButton";
import { TrackEdge, TrackTag } from "./TrackTag";
import { trackCompletion } from "@/domain/goals";
import { trackHref, trackWords, updateHref, type TrackAudience } from "@/domain/trackView";
import type { DeckCount } from "@/server/flashcards";
import { DeckLine, PractiseButton } from "./flashcards/Practise";
import { cardsLine } from "@/domain/flashcards";
import { Preparing } from "./Preparing";

/**
 * A track on the parent's tracks page (2g) or the learner's Your tracks (sm-4.1a). A self-managed learner also gets
 * "Start exam N" when an exam is ready, since they practise and manage on the same page.
 */
export function TrackCard({
  track: t,
  highlight,
  audience,
  timeZone,
  deck,
  cardsActivity,
}: {
  track: TrackSummary;
  highlight?: boolean;
  audience: TrackAudience;
  timeZone: string;
  /** The track's flashcards (0.3, fc-5): a learner practising here gets the deck line, Practise and Flashcards. */
  deck?: DeckCount;
  /** The parent's line (fc-7): the child's flashcard practice on this track, no card content. */
  cardsActivity?: { sessionsWeek: number; known: number; total: number };
}) {
  const runLength = t.goalRunLength ?? 3;
  const flashcards = audience.kind === "learner" && deck && (t.status === "active" || t.status === "goal_reached");
  const start = audience.kind === "learner" && t.readyExam && t.status === "active";
  const practise = flashcards && deck.practise;
  // The next exam is being written in the background (owner, 2026-11-16: show it's on its way).
  const preparing = t.status === "active" && !t.readyExam && t.nextExam !== "failed";
  const reached = t.status === "goal_reached";
  // From the first exam to the goal (or today, while going); the clock stops when the goal is reached.
  const days = trackDaysLabel(trackDays({ firstExamAt: t.firstExamAt, goalReachedAt: reached ? t.goalReachedAt : null }, timeZone), reached);
  const next = t.examsTaken === 0 ? "first exam" : "next exam";
  const examBox =
    t.nextExam === "failed"
      ? `The ${next} couldn't be written`
      : t.examReady
        ? `${t.examsTaken === 0 ? "No exams taken yet · " : ""}${next} is ready`
        : t.status === "active"
          ? `${t.examsTaken === 0 ? "No exams taken yet · " : ""}writing the ${next}…`
          : "";

  return (
    <article className={`card relative flex flex-col overflow-hidden ${highlight || t.status === "goal_reached" ? "border-2 border-brand" : ""}`} aria-labelledby={`track-${t.id}`}>
      <TrackEdge colorIndex={t.colorIndex} completion={trackCompletion({ progress: t.goalProgress, runLength, topics: t.topics, reached: t.status === "goal_reached" })} />
      <div className="mb-2">
        <TrackTag name={t.name ?? ""} colorIndex={t.colorIndex} />
      </div>
      <p className={`text-sm ${t.status === "goal_reached" ? "font-semibold text-brand" : "text-ink-muted"}`}>
        {t.status === "goal_reached" && t.goalReachedAt
          ? `Goal reached on ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone }).format(t.goalReachedAt)} · stopped`
          : trackStatusLine({ status: t.status, examsTaken: t.examsTaken, testDate: t.testDate, testLabel: t.testLabel })}
        {days && ` · ${days}`}
      </p>
      <h2 id={`track-${t.id}`} className="text-[22px] leading-snug">
        {t.name}
      </h2>

      {t.scores.length > 0 && (
        <div className="mt-4 flex items-end justify-between gap-4">
          <ScoreBars scores={t.scores} />
          <span className="text-sm text-ink-muted">
            {t.examsTaken} {t.examsTaken === 1 ? "exam" : "exams"} taken{examBox && !preparing ? ` · ${examBox.replace(/^./, (c) => c.toLowerCase())}` : ""}
          </span>
        </div>
      )}
      {preparing && t.scores.length > 0 && <Preparing className="mt-4" label={`Exam ${t.examsTaken + 1} being prepared…`} hold={t.nextExamHold} viewer="holder" />}
      <div className={`mt-4 flex min-h-[66px] flex-col items-center justify-center gap-2 rounded border border-dashed border-line-input px-4 py-3 text-center text-[15px] text-ink-muted ${t.scores.length ? "hidden" : ""}`}>
        {preparing ? (
          <Preparing
            className="w-full text-left"
            label={`${t.examsTaken === 0 ? "First exam" : `Exam ${t.examsTaken + 1}`} being prepared…`}
            note="Usually under a minute."
            hold={t.nextExamHold}
            viewer="holder"
          />
        ) : (
          examBox
        )}
        {t.nextExam === "failed" && (
          <form action={retryExam.bind(null, t.id, t.studentId)}>
            <button className="link min-h-touch font-semibold">Try again</button>
          </form>
        )}
      </div>

      <div className="mt-5">
        <TopicStrength topics={t.topics} />
      </div>
      <div className="mt-3">
        <NeedsWork topics={t.topics} />
      </div>

      {t.goalThreshold && (
        <div className="mt-4">
          <GoalProgress threshold={t.goalThreshold} runLength={runLength} progress={t.goalProgress} reached={t.status === "goal_reached"} topics={t.topics} />
        </div>
      )}

      {flashcards && <DeckLine deck={deck} timeZone={timeZone} reached={t.status === "goal_reached"} />}
      {audience.kind === "parent" && cardsActivity && cardsActivity.total > 0 && (
        <p className="mt-4 rounded bg-page px-3.5 py-3 text-sm">
          <strong>Flashcards</strong> · {cardsLine(cardsActivity.sessionsWeek, cardsActivity.known, cardsActivity.total)}
        </p>
      )}

      {(start || practise) && (
        <div className="mt-5 flex flex-col gap-2.5 border-t border-line pt-4">
          {start && t.readyExam && (
            <ExamLink href={`/exam/${t.readyExam.id}`} className="btn-primary h-12 px-5" aria-label={`${t.readyExam.started ? "Continue" : "Start"} exam ${t.readyExam.number} in ${t.name}`}>
              {t.readyExam.started ? "Continue" : "Start"} exam {t.readyExam.number}
            </ExamLink>
          )}
          <PractiseButton trackId={t.id} trackName={t.name ?? ""} deck={deck} from="tracks" className="h-12 px-5" />
        </div>
      )}

      <div className={`flex flex-wrap items-center gap-x-4 gap-y-0 ${start || practise ? "mt-3" : "mt-5 border-t border-line pt-4"}`}>
        {t.status === "goal_reached" ? (
          <>
            <Link href={updateHref(audience, t.id)} className="btn-primary">
              Add topics to continue
            </Link>
            {flashcards && deck.total > 0 && <FlashcardsLink id={t.id} name={t.name} />}
            <ArchiveButton trackId={t.id} studentId={t.studentId} trackName={t.name ?? ""} question={trackWords(audience).archiveQuestion} />
          </>
        ) : (
          <>
            {t.examsTaken > 0 && (
              <Link href={trackHref(audience, t.id)} className="link flex min-h-touch items-center font-semibold" aria-label={`Exam history of ${t.name}`}>
                Exam history
              </Link>
            )}
            {flashcards && deck.total > 0 && <FlashcardsLink id={t.id} name={t.name} />}
            {t.status !== "archived" && (
              <Link href={updateHref(audience, t.id)} className="link flex min-h-touch items-center font-semibold" aria-label={`Add material to ${t.name}`}>
                Add material
              </Link>
            )}
            {t.status === "active" && (
              <form action={pauseTrack.bind(null, t.id, t.studentId)}>
                <button className="link min-h-touch font-semibold no-underline hover:underline" aria-label={`Pause ${t.name}`}>
                  Pause
                </button>
              </form>
            )}
            {t.status === "paused" && (
              <form action={resumeTrack.bind(null, t.id, t.studentId)}>
                <button className="link min-h-touch font-semibold no-underline hover:underline" aria-label={`Resume ${t.name}`}>
                  Resume
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </article>
  );
}

/** To the deck (fc-6). */
function FlashcardsLink({ id, name }: { id: string; name: string | null }) {
  return (
    <Link href={`/tracks/${id}/flashcards`} className="link flex min-h-touch items-center font-semibold" aria-label={`Flashcards in ${name}`}>
      Flashcards
    </Link>
  );
}
