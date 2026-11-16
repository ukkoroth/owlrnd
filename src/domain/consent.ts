import { rules } from "@/config/rules";
import { ageOn } from "./identity";

/** Parent consent for an under-18 self-managed learner (editions §2.4, 0.2 plan M10). */

export type ConsentRequestState = { status: "pending" | "agreed" | "declined" | "expired"; createdAt: Date };
export type ConsentState = "not_needed" | "pending" | "overdue" | "agreed" | "declined";
export type Under18Mode = "practise_while_pending" | "block_until_consent";

const DAY = 24 * 60 * 60_000;

/** A learner under 18 on `todayIso` needs a parent's consent. No date of birth (0.1 children): no. */
export function needsConsent(dateOfBirth: string | null, todayIso: string): boolean {
  return !!dateOfBirth && ageOn(dateOfBirth, todayIso) < rules.accounts.ages.adult;
}

/**
 * Where consent stands. `first` is the learner's first request (when they first asked a parent): the 30-day pause
 * counts from it, so sending a new link doesn't restart the clock. `latest` is the newest request.
 */
export function consentState(
  needed: boolean,
  latest: ConsentRequestState | null,
  first: ConsentRequestState | null,
  now: Date,
  pauseAfterDays = rules.consent.pauseAfterDays,
): ConsentState {
  if (!needed) return "not_needed";
  if (latest?.status === "agreed") return "agreed";
  if (latest?.status === "declined") return "declined";
  const since = (first ?? latest)?.createdAt;
  // Not asked yet counts as pending: sign-up goes straight to "tell us your parent" (sm-1d).
  if (since && now.getTime() - since.getTime() > pauseAfterDays * DAY) return "overdue";
  return "pending";
}

/** Whether the learner may practise (take exams) in this state. */
export function practiceAllowed(state: ConsentState, mode: Under18Mode = rules.consent.under18Mode): boolean {
  if (state === "not_needed" || state === "agreed") return true;
  if (state === "pending") return mode === "practise_while_pending";
  return false;
}

export const linkExpiry = (from: Date) => new Date(from.getTime() + rules.consent.linkDays * DAY);
export const reminderAt = (from: Date) => new Date(from.getTime() + rules.consent.reminderAfterDays * DAY);
export const overdueAt = (from: Date) => new Date(from.getTime() + rules.consent.pauseAfterDays * DAY + 60_000);
