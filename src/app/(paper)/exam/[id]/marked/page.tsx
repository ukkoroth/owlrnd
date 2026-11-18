import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { MarkedPaper } from "@/components/exam/MarkedPaper";
import { requireShell } from "@/server/auth/current";
import { getMarkedPaper } from "@/server/results";

export const metadata: Metadata = { title: "Marked paper · owlrnd" };
export const dynamic = "force-dynamic";

// 4.1f
export default async function MarkedPaperPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string }> }) {
  const { user: { student } } = await requireShell("learner");
  const { id } = await params;
  const paper = await getMarkedPaper(student.id, id);
  if (!paper) redirect(`/exam/${id}/marking`);
  if (!paper.questions.length) notFound();
  // Opened from Past exams: both ways out lead back there.
  const fromPast = (await searchParams).from === "past";
  return fromPast ? (
    <MarkedPaper paper={paper} backHref="/today?tab=recent" backLabel="Back to past exams" doneHref="/today?tab=recent" doneLabel="Back to past exams" />
  ) : (
    <MarkedPaper paper={paper} />
  );
}
