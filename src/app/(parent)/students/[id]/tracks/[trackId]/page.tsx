import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumb";
import { TrackHistory } from "@/components/tracks/TrackHistory";
import { requireShell } from "@/server/auth/current";
import { topicStrengths } from "@/server/progress";
import { examHistory } from "@/server/trackUpdates";

export const metadata: Metadata = { title: "Exam history · owlrnd" };
export const dynamic = "force-dynamic";

// 2h
export default async function ExamHistoryPage({ params }: { params: Promise<{ id: string; trackId: string }> }) {
  const { actor } = await requireShell("parent");
  const { id, trackId } = await params;
  const h = await examHistory(actor, trackId);
  if (!h || h.student.id !== id) notFound();
  const { track, student, exams } = h;
  const strengths = (await topicStrengths(student.id, [trackId])).get(trackId) ?? [];

  return (
    <>
      <Breadcrumb items={[{ label: "Students", href: "/students" }, { label: student.name }, { label: "Tracks", href: `/students/${id}/tracks` }, { label: track.name ?? "" }]} />
      <TrackHistory
        audience={{ kind: "parent", studentId: id, studentName: student.name }}
        studentId={id}
        track={track}
        exams={exams}
        strengths={strengths}
        timeZone={student.timeZone}
      />
    </>
  );
}
