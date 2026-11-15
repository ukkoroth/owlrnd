import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { GoalProgress, NeedsWork, ScoreBars, StrengthLegend, TopicStrength } from "@/components/TrackBars";
import { formatTestDate } from "@/domain/tracks";
import { requireStudent } from "@/server/auth/current";
import { getStudentTracks, type StudentTrack } from "@/server/exams";

export const metadata: Metadata = { title: "Your tracks · owlrnd" };
export const dynamic = "force-dynamic";

const statusLine = (t: StudentTrack) => {
  if (t.status === "paused") return "Paused by your parent";
  if (t.status === "goal_reached") return "Goal reached. Well done!";
  const test = t.testDate ? ` · ${t.testLabel ?? "test"} on ${formatTestDate(t.testDate)}` : "";
  return (t.exam ? (t.exam.status === "in_progress" ? "Exam in progress" : "Next exam ready") : "Next exam being prepared") + test;
};

// 4.1a. Score bars and needs-work come with marking (M5).
export default async function YourTracksPage() {
  const { student } = await requireStudent();
  const list = await getStudentTracks(student.id);

  return (
    <>
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
                <GoalProgress threshold={t.goalThreshold} runLength={t.goalRunLength} progress={t.goalProgress} reached={t.status === "goal_reached"} />
              </div>
              <div className="mt-auto border-t border-line pt-4">
                {t.status === "paused" ? (
                  <p className="text-ink-muted">No new exams while paused</p>
                ) : t.status === "goal_reached" ? (
                  <p className="text-ink-muted">Waiting for new topics from your parent</p>
                ) : t.exam ? (
                  <Link href={`/exam/${t.exam.id}`} className="btn-primary">
                    {t.exam.status === "in_progress" ? "Continue" : "Start"} exam {t.exam.number}
                  </Link>
                ) : (
                  <p className="text-ink-muted">Your next exam will be ready soon</p>
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
