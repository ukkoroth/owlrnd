import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarkedPaper } from "@/components/exam/MarkedPaper";
import { requireParent } from "@/server/auth/current";
import { db } from "@/server/db";
import { exams } from "@/server/db/schema";
import { getMarkedPaper } from "@/server/results";
import { getOwnStudent } from "@/server/students";

export const metadata: Metadata = { title: "Marked paper · owlrnd" };
export const dynamic = "force-dynamic";

// 4.1f for a parent: only their own student's exams (rules §10).
export default async function ParentMarkedPaperPage({ params }: { params: Promise<{ id: string; examId: string }> }) {
  const { parent } = await requireParent();
  const { id, examId } = await params;
  const student = await getOwnStudent(parent.id, id);
  if (!student) notFound();
  const paper = await getMarkedPaper(student.id, examId);
  if (!paper) notFound();
  const [exam] = await db.select({ trackId: exams.trackId }).from(exams).where(and(eq(exams.id, examId), eq(exams.studentId, student.id)));
  return <MarkedPaper paper={paper} backHref={`/students/${id}/tracks/${exam!.trackId}`} backLabel="Back to exam history" doneHref={`/students/${id}/tracks/${exam!.trackId}`} doneLabel="Back to exam history" />;
}
