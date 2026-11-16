import { describe, expect, it } from "vitest";
import { learnerWords, markedPaperHref, newTrackHref, trackHref, tracksHref, trackWords, updateHref, type TrackAudience } from "./trackView";

const parent: TrackAudience = { kind: "parent", studentId: "s1", studentName: "Scout" };
const learner: TrackAudience = { kind: "learner" };

describe("track links by audience", () => {
  it("a parent manages under /students/[id]/tracks; a learner under /tracks", () => {
    expect([tracksHref(parent), newTrackHref(parent), trackHref(parent, "t1"), updateHref(parent, "t1")]).toEqual([
      "/students/s1/tracks",
      "/students/s1/tracks/new",
      "/students/s1/tracks/t1",
      "/students/s1/tracks/t1/update",
    ]);
    expect([tracksHref(learner), newTrackHref(learner), trackHref(learner, "t1"), updateHref(learner, "t1")]).toEqual([
      "/tracks",
      "/tracks/new",
      "/tracks/t1",
      "/tracks/t1/update",
    ]);
  });
  it("marked papers: the parent's view, or the learner's own", () => {
    expect(markedPaperHref(parent, "e1")).toBe("/students/s1/exams/e1/marked");
    expect(markedPaperHref(learner, "e1")).toBe("/exam/e1/marked");
  });
});

describe("words by audience", () => {
  it("names the child for a parent and says 'your' to a learner", () => {
    expect(trackWords(parent).firstTrack).toBe("Scout's first track");
    expect(trackWords(learner).firstTrack).toBe("your first track");
  });
  it("a self-managed learner never reads 'parent'", () => {
    for (const text of [...Object.values(trackWords(learner)), ...Object.values(learnerWords(true))]) expect(text).not.toMatch(/parent|child/i);
    expect(learnerWords(false).paused).toBe("Paused by your parent");
  });
});
