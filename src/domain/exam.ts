export type PaperQuestion = { id: string; type: "multiple_choice" | "short" };
export type AnswerValue = { chosenOption: number | null; text: string | null };

export function isBlank(q: PaperQuestion, a: AnswerValue | undefined): boolean {
  if (!a) return true;
  return q.type === "multiple_choice" ? a.chosenOption === null : !(a.text ?? "").trim();
}

/** Question numbers (1-based, in paper order) with no answer (screen 4.1c). */
export function blankQuestions(questions: PaperQuestion[], answers: Record<string, AnswerValue | undefined>): number[] {
  return questions.flatMap((q, i) => (isBlank(q, answers[q.id]) ? [i + 1] : []));
}

/** "Question 8 is blank." / "Questions 8 and 10 are blank." / "Questions 3, 5 and 8 are blank." */
export function blankSentence(numbers: number[]): string {
  if (numbers.length === 1) return `Question ${numbers[0]} is blank.`;
  const list = `${numbers.slice(0, -1).join(", ")} and ${numbers[numbers.length - 1]}`;
  return `Questions ${list} are blank.`;
}

/**
 * The learner's overall exam number for each suggested exam, in the order shown (owner, 2026-11-16). An exam already
 * started keeps the number it was given; the others are numbered on from the last one started, in suggestion
 * order. Those are predictions: whichever is started next becomes that number.
 */
export function overallNumbers(fixed: (number | null)[], lastStarted: number): number[] {
  let next = lastStarted;
  return fixed.map((n) => n ?? ++next);
}
