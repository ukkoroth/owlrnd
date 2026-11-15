import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireStudent } from "@/server/auth/current";
import { getPaper } from "@/server/exams";
import { MarkingProgress } from "./MarkingProgress";

export const metadata: Metadata = { title: "Marking · owlrnd" };
export const dynamic = "force-dynamic";

// 4.1d: shown after submitting while the answers are marked; moves on to the result by itself.
export default async function MarkingPage({ params }: { params: Promise<{ id: string }> }) {
  const { student } = await requireStudent();
  const { id } = await params;
  const paper = await getPaper(student.id, id);
  if (!paper) notFound();
  if (paper.status === "marked") redirect(`/exam/${id}/result`);
  if (paper.status === "ready" || paper.status === "in_progress") redirect(`/exam/${id}`);
  const mcq = paper.questions.filter((q) => q.type === "multiple_choice").length;
  const short = paper.questions.length - mcq;

  return (
    <div className="flex min-h-dvh flex-col font-sans">
      <header className="flex h-[60px] items-center justify-between border-b border-paper-rule px-4 md:px-10">
        <p className="truncate font-semibold">
          {paper.trackName} <span className="ml-2 font-normal text-paper-muted">Submitted</span>
        </p>
        {/* A full load, so the dashboard never comes from the client router cache. */}
        <a href="/today" className="flex min-h-touch shrink-0 items-center gap-2 text-[15px] hover:underline">
          <span aria-hidden="true">←</span> Back to dashboard
        </a>
      </header>
      <main className="mx-auto flex w-full max-w-[480px] flex-1 flex-col justify-center px-6 py-12">
        <h1 className="text-[28px] font-semibold">Marking your answers</h1>
        <p className="mt-2 text-[16px] leading-relaxed text-paper-muted">
          {short > 0 ? "The AI is reading your written answers. This usually takes less than a minute." : "This takes a few seconds."} You can leave this page;
          your result will be on your dashboard.
        </p>
        <MarkingProgress examId={id} mcq={mcq} short={short} />
      </main>
    </div>
  );
}
