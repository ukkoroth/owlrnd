import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { MarkedPaper } from "@/components/exam/MarkedPaper";
import { requireStudent } from "@/server/auth/current";
import { getMarkedPaper } from "@/server/results";

export const metadata: Metadata = { title: "Marked paper · owlrnd" };
export const dynamic = "force-dynamic";

// 4.1f
export default async function MarkedPaperPage({ params }: { params: Promise<{ id: string }> }) {
  const { student } = await requireStudent();
  const { id } = await params;
  const paper = await getMarkedPaper(student.id, id);
  if (!paper) redirect(`/exam/${id}/marking`);
  if (!paper.questions.length) notFound();
  return <MarkedPaper paper={paper} />;
}
