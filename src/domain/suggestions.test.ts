import { describe, expect, it } from "vitest";
import { completedToday, suggestExams, type SuggestionCandidate } from "./suggestions";

const exam = { id: "e", number: 1, status: "ready" as const };
const t = (id: string, over: Partial<SuggestionCandidate> = {}): SuggestionCandidate => ({
  id,
  status: "active",
  testDate: null,
  lastPracticedAt: null,
  weakTopics: 0,
  exam,
  ...over,
});
const ids = (xs: SuggestionCandidate[]) => xs.map((x) => x.id);
const today = "2026-11-14";

describe("suggestExams (rules §7)", () => {
  it("puts the nearest upcoming test first, ignoring past tests", () => {
    const out = suggestExams([t("later", { testDate: "2026-11-30" }), t("past", { testDate: "2026-11-01" }), t("soon", { testDate: "2026-11-20" })], today);
    expect(ids(out)).toEqual(["soon", "later", "past"]);
  });

  it("then the track not practised for the longest (never practised first)", () => {
    const out = suggestExams(
      [t("yesterday", { lastPracticedAt: new Date("2026-11-13") }), t("never"), t("last week", { lastPracticedAt: new Date("2026-11-07") })],
      today,
    );
    expect(ids(out)).toEqual(["never", "last week", "yesterday"]);
  });

  it("then the most weak topics", () => {
    expect(ids(suggestExams([t("a", { weakTopics: 1 }), t("b", { weakTopics: 3 })], today))).toEqual(["b", "a"]);
  });

  it("shows at most 3, only active tracks with an exam to take", () => {
    const out = suggestExams(
      [t("1"), t("2"), t("paused", { status: "paused" }), t("noexam", { exam: null }), t("3"), t("4"), t("reached", { status: "goal_reached" })],
      today,
    );
    expect(ids(out)).toEqual(["1", "2", "3"]);
  });
});

describe("completedToday", () => {
  it("counts in the student's time zone", () => {
    const now = new Date("2026-11-14T20:00:00Z"); // 15 Nov 01:30 in Kolkata
    const done = [new Date("2026-11-14T10:00:00Z"), new Date("2026-11-14T19:00:00Z")];
    expect(completedToday(done, "UTC", now)).toBe(2);
    expect(completedToday(done, "Asia/Kolkata", now)).toBe(1); // 10:00Z was the 14th there
  });
});
