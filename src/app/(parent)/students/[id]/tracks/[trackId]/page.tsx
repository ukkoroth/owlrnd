import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumb";
import { PageHeader } from "@/components/PageHeader";
import { GoalProgress } from "@/components/TrackBars";
import { inSentence } from "@/domain/examMix";
import { requireParent } from "@/server/auth/current";
import { topicStrengths } from "@/server/progress";
import { examHistory } from "@/server/trackUpdates";
import { pauseTrack, resumeTrack } from "../actions";

export const metadata: Metadata = { title: "Exam history · owlrnd" };
export const dynamic = "force-dynamic";

const statusWord: Record<string, string> = { active: "Active", paused: "Paused", goal_reached: "Goal reached · stopped", archived: "Archived" };

// 2h
export default async function ExamHistoryPage({ params }: { params: Promise<{ id: string; trackId: string }> }) {
  const { parent } = await requireParent();
  const { id, trackId } = await params;
  const h = await examHistory(parent.id, trackId);
  if (!h || h.student.id !== id) notFound();
  const { track, student, exams } = h;
  const strengths = (await topicStrengths(student.id, [trackId])).get(trackId) ?? [];
  const strong = strengths.filter((t) => t.strength === "strong").length;
  const day = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: student.timeZone }).format(d);
  const names = (xs: string[]) => (xs.length ? xs.map((x, i) => (i === 0 ? x : inSentence(x))).join(", ") : "—");

  return (
    <>
      <Breadcrumb items={[{ label: "Students", href: "/students" }, { label: student.name }, { label: "Tracks", href: `/students/${id}/tracks` }, { label: track.name ?? "" }]} />
      <PageHeader
        title={track.name ?? ""}
        subtitle={`${statusWord[track.status] ?? ""} · ${exams.length} ${exams.length === 1 ? "exam" : "exams"} taken · ${strong} of ${strengths.length} topics strong`}
      />
      <div className="max-w-[560px]">
        <GoalProgress threshold={track.goalThreshold ?? 8} runLength={track.goalRunLength ?? 3} progress={track.goalProgress} reached={track.status === "goal_reached"} />
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
                  <a href={`/students/${id}/exams/${e.id}/marked`} className="link font-semibold" aria-label={`Marked paper for exam ${e.number}`}>
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
          <Link href={`/students/${id}/tracks/${trackId}/update`} className="btn-outline">
            {track.status === "goal_reached" ? "Add topics to continue" : "Add material"}
          </Link>
        )}
        {track.status === "active" && (
          <form action={pauseTrack.bind(null, trackId, id)}>
            <button className="link min-h-touch font-semibold">Pause track</button>
          </form>
        )}
        {track.status === "paused" && (
          <form action={resumeTrack.bind(null, trackId, id)}>
            <button className="link min-h-touch font-semibold">Resume track</button>
          </form>
        )}
      </div>
    </>
  );
}
