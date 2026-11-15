"use server";

import { redirect } from "next/navigation";
import { requireStudent } from "@/server/auth/current";
import * as exams from "@/server/exams";
import { markingStatus } from "@/server/marking";

export async function saveAnswer(examId: string, questionId: string, value: { chosenOption: number | null; text: string | null }): Promise<boolean> {
  const { student } = await requireStudent();
  return exams.saveAnswer(student.id, examId, questionId, value);
}

export async function submitExam(examId: string): Promise<void> {
  const { student } = await requireStudent();
  if (!(await exams.submitExam(student.id, examId))) redirect("/today");
  redirect(`/exam/${examId}/marking`);
}

/** 4.1d polls this until the exam is marked. */
export async function examStatus(examId: string): Promise<string | null> {
  const { student } = await requireStudent();
  return markingStatus(student.id, examId);
}
