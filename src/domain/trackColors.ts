/**
 * A colour per track (owner, 2026-11-16): a small tag and a left border on the track's cards, the same everywhere
 * the track appears. Eight light fills with dark text (at least 4.5:1 contrast), told apart by hue and lightness
 * so neighbouring tags stay distinct for colour-blind users too. Amber is left out: it is the landing page's accent.
 */
export type TrackColor = { name: string; fill: string; text: string; border: string };

export const TRACK_COLORS: readonly TrackColor[] = [
  { name: "teal", fill: "#D3F1EC", text: "#0B4D45", border: "#159A88" },
  { name: "purple", fill: "#ECE4FB", text: "#45288A", border: "#7C4DDB" },
  { name: "rose", fill: "#FBE2EA", text: "#851A3A", border: "#D2456E" },
  { name: "sky", fill: "#DCEFFB", text: "#0B4568", border: "#2B8FC9" },
  { name: "green", fill: "#DFF2DB", text: "#22531C", border: "#3E9A34" },
  { name: "orange", fill: "#FCE6D5", text: "#743708", border: "#DA6F1D" },
  { name: "indigo", fill: "#E2E5FA", text: "#2A2F86", border: "#5B63D6" },
  { name: "olive", fill: "#EEE9D9", text: "#544519", border: "#9C8443" },
];

export const trackColor = (index: number): TrackColor => TRACK_COLORS[((index % TRACK_COLORS.length) + TRACK_COLORS.length) % TRACK_COLORS.length]!;

/** For a new track: the colour the learner's current tracks use least (the earliest of those on a tie). */
export function pickTrackColor(usedIndexes: number[]): number {
  const counts = TRACK_COLORS.map((_, i) => usedIndexes.filter((u) => u % TRACK_COLORS.length === i).length);
  const least = Math.min(...counts);
  return counts.indexOf(least);
}

/** The tag's words: the part after "Subject: " (the chapter or test), or the whole name. */
export function trackTagLabel(name: string): string {
  const i = name.indexOf(":");
  const rest = i >= 0 ? name.slice(i + 1).trim() : "";
  return rest || name.trim();
}
