import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ExamPaper } from "@/components/exam/ExamPaper";
import { requireStudent } from "@/server/auth/current";
import { getPaper, startExam } from "@/server/exams";

export const metadata: Metadata = { title: "Exam · owlrnd" };
export const dynamic = "force-dynamic";

// 4.1b (and 4.1c, 4.2b). Opening a ready exam starts it; a submitted one goes to its status page.
export default async function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { student } = await requireStudent();
  const { id } = await params;
  const paper = await getPaper(student.id, id);
  if (!paper) notFound();
  if (paper.status === "marked") redirect(`/exam/${id}/result`);
  if (paper.status !== "ready" && paper.status !== "in_progress") redirect(`/exam/${id}/marking`);
  if (!(await startExam(student.id, id))) redirect("/today");
  return <ExamPaper paper={{ ...paper, status: "in_progress" }} />;
}
