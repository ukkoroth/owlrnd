import { rules } from "@/config/rules";

/** Rules §6: the score shown is out of 10, scaled from total marks and rounded. */
export function scoreOutOf10(awarded: number, available: number): number {
  if (available <= 0) return 0;
  return Math.round((awarded / available) * rules.marks.scoreOutOf);
}

/** Lower case, no punctuation, no spaces: "Ohm's Law." and "ohms law" compare equal; "10 V" and "10V" too. */
export function normaliseShortAnswer(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}.Ω°%/]+/gu, "")
    .replace(/\.(?!\d)/g, "");
}

/** An exact match is marked correct without asking the AI. Anything else (except blank) goes to the AI. */
export function exactMatch(expected: string, given: string): boolean {
  const g = normaliseShortAnswer(given);
  return g.length > 0 && g === normaliseShortAnswer(expected);
}
