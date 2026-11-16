/**
 * Who is looking at a track screen, and the links and words that follow from it (0.2 plan, M9). A parent manages a
 * child's tracks under /students/[id]/…; a self-managed learner manages their own under /tracks/…. The screens are
 * the same components; only these differ.
 */
export type TrackAudience = { kind: "parent"; studentId: string; studentName: string } | { kind: "learner" };

const parentBase = (a: { studentId: string }) => `/students/${a.studentId}/tracks`;

export const tracksHref = (a: TrackAudience) => (a.kind === "parent" ? parentBase(a) : "/tracks");
export const newTrackHref = (a: TrackAudience) => `${tracksHref(a)}/new`;
export const trackHref = (a: TrackAudience, trackId: string) => `${tracksHref(a)}/${trackId}`;
export const updateHref = (a: TrackAudience, trackId: string) => `${trackHref(a, trackId)}/update`;
/** The marked paper from a track's exam history: the parent's read-only view, or the learner's own. */
export const markedPaperHref = (a: TrackAudience, examId: string) =>
  a.kind === "parent" ? `/students/${a.studentId}/exams/${examId}/marked` : `/exam/${examId}/marked`;

/** The words that change with the audience. "Scout's" / "your", and so on. */
export function trackWords(a: TrackAudience) {
  if (a.kind === "parent") {
    const n = a.studentName;
    return {
      whose: `${n}'s`,
      firstTrack: `${n}'s first track`,
      newTrack: `a new track for ${n}`,
      tracksTitle: `${n}'s tracks`,
      backToTracks: `Back to ${n}'s tracks`,
      openTracks: `Open ${n}'s tracks`,
      /** Subject of "… reached the goal". */
      who: n,
      archiveQuestion: `Hide it from ${n}? Its history stays here.`,
      firstExamWhere: `${n} will see its first exam on their dashboard the next time they sign in.`,
    };
  }
  return {
    whose: "your",
    firstTrack: "your first track",
    newTrack: "a new track",
    tracksTitle: "Your tracks",
    backToTracks: "Back to your tracks",
    openTracks: "Open your tracks",
    who: "You",
    archiveQuestion: "Archive it? It moves out of your tracks and its history stays.",
    firstExamWhere: "Its first exam is being written and will be on your dashboard in a minute or two.",
  };
}

/** Learner screens (3c–3g, 4.1a, 4.1e): wording for a self-managed learner, or a child whose parent manages them. */
export function learnerWords(selfManaged: boolean) {
  return selfManaged
    ? {
        paused: "Paused",
        noTracks: "You set up what you practise. Your first exam will appear here as soon as you create a track.",
        caughtUp: "Add new topics to start them again, or create a new track.",
        noTracksYet: "You haven't set up a track yet.",
        waitingForTopics: "Waiting for you to add topics",
        trackStops: "A track stops when its goal is reached, until you add topics.",
        untilTopics: "until you add new topics",
        firstTrackReady: "Your first track is ready.",
      }
    : {
        paused: "Paused by your parent",
        noTracks: "Your parent sets up what you practise. Your first exam will appear here as soon as they do.",
        caughtUp: "Your parent can add new topics or resume a track to start it again.",
        noTracksYet: "Your parent hasn't set up a track yet.",
        waitingForTopics: "Waiting for new topics from your parent",
        trackStops: "A track stops when its goal is reached, until your parent adds topics.",
        untilTopics: "until your parent adds new topics",
        firstTrackReady: "Your parent has set up your first track.",
      };
}
