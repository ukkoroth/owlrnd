import { trackStatusLine } from "@/domain/tracks";
import { GoalProgress, NeedsWork, ScoreBars, TopicStrength } from "./TrackBars";
import type { TrackSummary } from "@/server/tracks";
import Link from "next/link";
import { pauseTrack, resumeTrack, retryExam } from "@/app/(parent)/students/[id]/tracks/actions";
import { ArchiveButton } from "./ArchiveButton";

/** A track on the parent's tracks page (2g). Score bars and needs-work arrive with exams (M4/M5). */
export function TrackCard({ track: t, highlight, studentName, timeZone }: { track: TrackSummary; highlight?: boolean; studentName: string; timeZone: string }) {
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
    <article className={`card flex flex-col ${highlight || t.status === "goal_reached" ? "border-2 border-brand" : ""}`} aria-labelledby={`track-${t.id}`}>
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
          <GoalProgress threshold={t.goalThreshold} runLength={runLength} progress={t.goalProgress} reached={t.status === "goal_reached"} />
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-4">
        {t.status === "goal_reached" ? (
          <>
            <Link href={`/students/${t.studentId}/tracks/${t.id}/update`} className="btn-primary">
              Add topics to continue
            </Link>
            <ArchiveButton trackId={t.id} studentId={t.studentId} trackName={t.name ?? ""} studentName={studentName} />
          </>
        ) : (
          <>
            {t.examsTaken > 0 && (
              <Link href={`/students/${t.studentId}/tracks/${t.id}`} className="link flex min-h-touch items-center font-semibold" aria-label={`Exam history of ${t.name}`}>
                Exam history
              </Link>
            )}
            {t.status !== "archived" && (
              <Link href={`/students/${t.studentId}/tracks/${t.id}/update`} className="link flex min-h-touch items-center font-semibold" aria-label={`Add material to ${t.name}`}>
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
