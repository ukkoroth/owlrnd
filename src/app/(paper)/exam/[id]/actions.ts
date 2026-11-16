"use server";

import { redirect } from "next/navigation";
import { requireShell } from "@/server/auth/current";
import * as exams from "@/server/exams";
import { markingStatus } from "@/server/marking";

export async function saveAnswer(examId: string, questionId: string, value: { chosenOption: number | null; text: string | null }): Promise<boolean> {
  const { user: { student } } = await requireShell("learner");
  return exams.saveAnswer(student.id, examId, questionId, value);
}

export async function submitExam(examId: string): Promise<void> {
  const { user: { student } } = await requireShell("learner");
  if (!(await exams.submitExam(student.id, examId))) redirect("/today");
  redirect(`/exam/${examId}/marking`);
}

/** 4.1d polls this until the exam is marked. */
export async function examStatus(examId: string): Promise<string | null> {
  const { user: { student } } = await requireShell("learner");
  return markingStatus(student.id, examId);
}
