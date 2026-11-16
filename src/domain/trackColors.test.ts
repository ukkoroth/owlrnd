import { describe, expect, it } from "vitest";
import { pickTrackColor, TRACK_COLORS, trackColor, trackTagLabel } from "./trackColors";

// WCAG relative luminance and contrast ratio.
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

describe("track colours", () => {
  it("every tag's text is readable on its fill (at least 4.5:1) and every colour is different", () => {
    for (const c of TRACK_COLORS) expect(contrast(c.text, c.fill), c.name).toBeGreaterThanOrEqual(4.5);
    expect(new Set(TRACK_COLORS.map((c) => c.fill)).size).toBe(TRACK_COLORS.length);
  });
  it("a new track gets the least-used colour, so a learner's tracks differ", () => {
    expect(pickTrackColor([])).toBe(0);
    expect(pickTrackColor([0, 1, 2])).toBe(3);
    expect(pickTrackColor([0, 1, 2, 3, 4, 5, 6, 7, 0])).toBe(1);
  });
  it("wraps any stored index into the palette", () => {
    expect(trackColor(8)).toBe(TRACK_COLORS[0]);
  });
  it("the tag shows the chapter part of the name", () => {
    expect(trackTagLabel("Chemistry: Chemical reactions")).toBe("Chemical reactions");
    expect(trackTagLabel("Revision")).toBe("Revision");
  });
});
