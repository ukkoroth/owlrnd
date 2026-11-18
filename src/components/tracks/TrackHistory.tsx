import Link from "next/link";
import { pauseTrack, resumeTrack } from "@/app/_actions/tracks";
import { PageHeader } from "@/components/PageHeader";
import { GoalProgress } from "@/components/TrackBars";
import { inSentence } from "@/domain/examMix";
import { markedPaperHref, trackWords, tracksHref, updateHref, type TrackAudience } from "@/domain/trackView";
import { ArchiveButton, DeleteTrackButton, RestoreButton } from "@/components/ArchiveButton";
import type { TopicWithStrength } from "@/server/progress";
import type { Track } from "@/server/tracks";

const statusWord: Record<string, string> = { active: "Active", paused: "Paused", goal_reached: "Goal reached · stopped", archived: "Archived" };

type Props = {
  audience: TrackAudience;
  studentId: string;
  track: Track;
  exams: { id: string; number: number; score: number; submittedAt: Date; strong: string[]; needsWork: string[] }[];
  strengths: TopicWithStrength[];
  timeZone: string;
};

/** A track's exam history: the parent's 2h and the learner's sm-2g. */
export function TrackHistory({ audience, studentId, track, exams, strengths, timeZone }: Props) {
  const strong = strengths.filter((t) => t.strength === "strong").length;
  const day = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone }).format(d);
  const names = (xs: string[]) => (xs.length ? xs.map((x, i) => (i === 0 ? x : inSentence(x))).join(", ") : "—");

  return (
    <>
      <PageHeader
        title={track.name ?? ""}
        subtitle={`${statusWord[track.status] ?? ""} · ${exams.length} ${exams.length === 1 ? "exam" : "exams"} taken · ${strong} of ${strengths.length} topics strong`}
      />
      <div className="max-w-[560px]">
        <GoalProgress threshold={track.goalThreshold ?? 8} runLength={track.goalRunLength ?? 3} progress={track.goalProgress} reached={track.status === "goal_reached"} topics={strengths} />
      </div>

      <div className="mt-6 overflow-x-auto rounded border border-line bg-card">
        <table className="w-full min-w-[640px] text-left text-[15px]">
          <caption className="sr-only">Exams in {track.name}, newest first</caption>
          <thead className="border-b border-line text-[13px] uppercase tracking-wider text-ink-muted">
            <tr>
              {["Exam", "Date", "Score", "Strong", "Needs work", "Marked paper"].map((h) => (
                <th key={h} scope="col" className="whitespace-nowrap px-5 py-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {exams.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-ink-muted">
                  No marked exams yet.
                </td>
              </tr>
            )}
            {exams.map((e) => (
              <tr key={e.id}>
                <th scope="row" className="whitespace-nowrap px-5 py-3 font-semibold">
                  Exam {e.number}
                </th>
                <td className="whitespace-nowrap px-5 py-3">{day(e.submittedAt)}</td>
                <td className="whitespace-nowrap px-5 py-3 font-semibold">{e.score} / 10</td>
                <td className="px-5 py-3">{names(e.strong)}</td>
                <td className="px-5 py-3">{names(e.needsWork)}</td>
                <td className="whitespace-nowrap px-5 py-3">
                  <a href={markedPaperHref(audience, e.id)} className="link font-semibold" aria-label={`Marked paper for exam ${e.number}`}>
                    Marked paper
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-5">
        {track.status !== "archived" && (
          <Link href={updateHref(audience, track.id)} className="btn-outline">
            {track.status === "goal_reached" ? "Add topics to continue" : "Add material"}
          </Link>
        )}
        {track.status === "active" && (
          <form action={pauseTrack.bind(null, track.id, studentId)}>
            <button className="link min-h-touch font-semibold">Pause track</button>
          </form>
        )}
        {track.status === "paused" && (
          <form action={resumeTrack.bind(null, track.id, studentId)}>
            <button className="link min-h-touch font-semibold">Resume track</button>
          </form>
        )}
        {track.status === "archived" ? (
          <RestoreButton trackId={track.id} studentId={studentId} trackName={track.name ?? ""} />
        ) : (
          <ArchiveButton trackId={track.id} studentId={studentId} trackName={track.name ?? ""} question={trackWords(audience).archiveQuestion} examOpen={track.nextExam === "ready"} />
        )}
        <DeleteTrackButton trackId={track.id} studentId={studentId} trackName={track.name ?? ""} then={tracksHref(audience)} />
      </div>
    </>
  );
}
