import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumb";
import { TrackHistory } from "@/components/tracks/TrackHistory";
import { requireShell } from "@/server/auth/current";
import { topicStrengths } from "@/server/progress";
import { examHistory } from "@/server/trackUpdates";

export const metadata: Metadata = { title: "Exam history · owlrnd" };
export const dynamic = "force-dynamic";

// sm-2g. Only for a self-managed learner: a child's track history is their parent's page.
export default async function LearnerExamHistoryPage({ params }: { params: Promise<{ trackId: string }> }) {
  const { user: { student }, actor } = await requireShell("learner");
  if (student.type !== "self_managed") notFound();
  const { trackId } = await params;
  const h = await examHistory(actor, trackId);
  if (!h) notFound();
  const strengths = (await topicStrengths(student.id, [trackId])).get(trackId) ?? [];

  return (
    <>
      <Breadcrumb items={[{ label: "Tracks", href: "/tracks" }, { label: h.track.name ?? "" }]} />
      <TrackHistory audience={{ kind: "learner" }} studentId={student.id} track={h.track} exams={h.exams} strengths={strengths} timeZone={student.timeZone} />
    </>
  );
}
