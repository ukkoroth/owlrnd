import { describe, expect, it } from "vitest";
import { canCreateTrack, emptyPreview, formatTestDate, goalLabel, isIsoDate, trackStatusLine, type TrackPreview } from "./tracks";

const ready: TrackPreview = {
  name: "Physics: Current electricity",
  topics: [{ name: "Ohm's law", description: "V = IR" }],
  testDate: "2026-11-20",
  testLabel: "unit test",
  goal: { threshold: 9, runLength: 3 },
  focusNotes: null,
};

describe("goalLabel (rules §3)", () => {
  it("reads like the mockups", () => {
    expect(goalLabel({ threshold: 9, runLength: 3 }, "off")).toBe("9 / 10 or better in 3 exams in a row");
    expect(goalLabel({ threshold: 8, runLength: 1 }, "off")).toBe("8 / 10 or better in 1 exam");
    // 0.2: the goal also needs every topic strong (the default).
    expect(goalLabel({ threshold: 9, runLength: 3 })).toBe("9 / 10 or better in 3 exams in a row, with every topic strong");
  });
});

describe("formatTestDate", () => {
  it("is 'Fri 20 Nov' and never shifts a day", () => {
    expect(formatTestDate("2026-11-20")).toBe("Fri 20 Nov");
  });
  it("rejects impossible dates", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-11-20")).toBe(true);
    expect(isIsoDate("20 Nov")).toBe(false);
  });
});

describe("canCreateTrack", () => {
  it("needs a name, 1–12 topics and a valid goal; the test date is optional", () => {
    expect(canCreateTrack(ready)).toBe(true);
    expect(canCreateTrack({ ...ready, testDate: null })).toBe(true);
    expect(canCreateTrack(emptyPreview)).toBe(false);
    expect(canCreateTrack({ ...ready, name: " " })).toBe(false);
    expect(canCreateTrack({ ...ready, topics: [] })).toBe(false);
    expect(canCreateTrack({ ...ready, topics: Array(13).fill({ name: "x", description: "" }) })).toBe(false);
    expect(canCreateTrack({ ...ready, goal: null })).toBe(false);
    expect(canCreateTrack({ ...ready, goal: { threshold: 11, runLength: 3 } })).toBe(false);
    expect(canCreateTrack({ ...ready, testDate: "next Friday" })).toBe(false);
  });
});

describe("trackStatusLine (2g)", () => {
  it("says New before any exam, and names the test", () => {
    expect(trackStatusLine({ status: "active", examsTaken: 0, testDate: "2026-11-20", testLabel: "unit test" })).toBe("New · unit test on Fri 20 Nov");
    expect(trackStatusLine({ status: "active", examsTaken: 2, testDate: null, testLabel: null })).toBe("Active");
    expect(trackStatusLine({ status: "paused", examsTaken: 2, testDate: "2026-11-20", testLabel: null })).toBe("Paused · test on Fri 20 Nov");
  });
});

import { sanitizePreview, todayIn } from "./tracks";

describe("sanitizePreview (never trust the AI's fields as-is)", () => {
  const today = "2026-11-14";
  it("keeps a good preview", () => {
    expect(sanitizePreview(ready, today)).toEqual(ready);
  });
  it("drops past or invalid dates (and their label), bad goals, blank and duplicate topics", () => {
    const out = sanitizePreview(
      {
        ...ready,
        testDate: "2026-11-13",
        goal: { threshold: 12, runLength: 3 },
        topics: [
          { name: " Ohm's law ", description: "" },
          { name: "ohm's LAW", description: "dup" },
          { name: "  ", description: "blank" },
        ],
      },
      today,
    );
    expect(out.testDate).toBeNull();
    expect(out.testLabel).toBeNull();
    expect(out.goal).toBeNull();
    expect(out.topics).toEqual([{ name: "Ohm's law", description: "" }]);
  });
  it("caps topics at 12", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ name: `Topic ${i}`, description: "" }));
    expect(sanitizePreview({ ...ready, topics: many }, today).topics).toHaveLength(12);
  });
});

describe("todayIn", () => {
  it("uses the given time zone", () => {
    const t = new Date("2026-11-14T20:00:00Z");
    expect(todayIn("UTC", t)).toBe("2026-11-14");
    expect(todayIn("Asia/Kolkata", t)).toBe("2026-11-15");
  });
});
