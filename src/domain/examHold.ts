import { rules } from "@/config/rules";

/** Why a track's next exam is postponed (tracks.next_exam_hold). The job retries by itself; nothing has failed. */
export type ExamHold = "allowance" | "daily_limit" | "budget" | "consent";

/**
 * Who is reading: the account holder (a parent, or a self-managed learner, who can act on the allowance) or a child
 * whose parent holds the account.
 */
export type HoldViewer = "holder" | "child";

/** The line shown in place of "being prepared" while the exam is on hold. */
export function examHoldNote(hold: ExamHold, viewer: HoldViewer): string {
  switch (hold) {
    case "allowance":
      return viewer === "holder"
        ? "On hold: your AI allowance is used up. Contact us to buy a package and it's written straight away."
        : "On hold: your parent's AI allowance is used up. Ask your parent to top it up.";
    case "daily_limit":
      return `On hold: today's limit of ${rules.aiLimits.examsWrittenPerDay} new exams is reached. It will be written tomorrow.`;
    case "budget":
      return "On hold for a little while. It will be written soon, with nothing for you to do.";
    case "consent":
      return viewer === "holder" ? "On hold until your parent agrees." : "On hold for now.";
  }
}
