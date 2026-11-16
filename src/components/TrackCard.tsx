import { trackStatusLine } from "@/domain/tracks";
import { GoalProgress, NeedsWork, ScoreBars, TopicStrength } from "./TrackBars";
import type { TrackSummary } from "@/server/tracks";
import Link from "next/link";
import { pauseTrack, resumeTrack, retryExam } from "@/app/_actions/tracks";
import { ArchiveButton } from "./ArchiveButton";
import { TrackEdge, TrackTag } from "./TrackTag";
import { trackCompletion } from "@/domain/goals";
import { trackHref, trackWords, updateHref, type TrackAudience } from "@/domain/trackView";

/**
 * A track on the parent's tracks page (2g) or the learner's Your tracks (sm-4.1a). A self-managed learner also gets
 * "Start exam N" when an exam is ready, since they practise and manage on the same page.
 */
export function TrackCard({ track: t, highlight, audience, timeZone }: { track: TrackSummary; highlight?: boolean; audience: TrackAudience; timeZone: string }) {
  const runLength = t.goalRunLength ?? 3;
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
      </p>
      <h2 id={`track-${t.id}`} className="text-[22px] leading-snug">
        {t.name}
      </h2>

      {t.scores.length > 0 && (
        <div className="mt-4 flex items-end justify-between gap-4">
          <ScoreBars scores={t.scores} />
          <span className="text-sm text-ink-muted">
            {t.examsTaken} {t.examsTaken === 1 ? "exam" : "exams"} taken{examBox ? ` · ${examBox.replace(/^./, (c) => c.toLowerCase())}` : ""}
          </span>
        </div>
      )}
      <div className={`mt-4 flex min-h-[66px] flex-col items-center justify-center gap-2 rounded border border-dashed border-line-input px-4 py-3 text-center text-[15px] text-ink-muted ${t.scores.length ? "hidden" : ""}`}>
        {examBox}
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

      {audience.kind === "learner" && t.readyExam && t.status === "active" && (
        <div className="mt-5 border-t border-line pt-4">
          <Link href={`/exam/${t.readyExam.id}`} className="btn-primary h-12 px-5" aria-label={`${t.readyExam.started ? "Continue" : "Start"} exam ${t.readyExam.number} in ${t.name}`}>
            {t.readyExam.started ? "Continue" : "Start"} exam {t.readyExam.number}
          </Link>
        </div>
      )}

      <div className={`flex flex-wrap items-center gap-x-5 gap-y-2 ${audience.kind === "learner" && t.readyExam && t.status === "active" ? "mt-3" : "mt-5 border-t border-line pt-4"}`}>
        {t.status === "goal_reached" ? (
          <>
            <Link href={updateHref(audience, t.id)} className="btn-primary">
              Add topics to continue
            </Link>
            <ArchiveButton trackId={t.id} studentId={t.studentId} trackName={t.name ?? ""} question={trackWords(audience).archiveQuestion} />
          </>
        ) : (
          <>
            {t.examsTaken > 0 && (
              <Link href={trackHref(audience, t.id)} className="link flex min-h-touch items-center font-semibold" aria-label={`Exam history of ${t.name}`}>
                Exam history
              </Link>
            )}
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
