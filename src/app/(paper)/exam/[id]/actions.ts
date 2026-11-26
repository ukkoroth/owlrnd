"use server";

import { redirect } from "next/navigation";
import { requirePractice } from "@/server/auth/current";
import * as exams from "@/server/exams";
import { markingStatus } from "@/server/marking";
import type { SubmitBlock } from "@/domain/rushGuard";

export async function saveAnswer(examId: string, questionId: string, value: { chosenOption: number | null; text: string | null }): Promise<boolean> {
  const { user: { student } } = await requirePractice();
  return exams.saveAnswer(student.id, examId, questionId, value);
}

/** Hands the paper in, or says why it can't be yet (rules §5a: rushed papers). */
export async function submitExam(examId: string): Promise<SubmitBlock | void> {
  const { user: { student } } = await requirePractice();
  const block = await exams.rushCheck(student.id, examId);
  if (block) return block;
  if (!(await exams.submitExam(student.id, examId))) redirect("/today");
  redirect(`/exam/${examId}/marking`);
}

/** 4.1d polls this until the exam is marked. */
export async function examStatus(examId: string): Promise<string | null> {
  const { user: { student } } = await requirePractice();
  return markingStatus(student.id, examId);
}
