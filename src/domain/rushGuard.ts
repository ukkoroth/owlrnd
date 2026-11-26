import { rules } from "@/config/rules";
import type { AnswerValue, PaperQuestion } from "./exam";

/**
 * Rushed papers (rules §5a, owner 2026-11-26): a paper can't be handed in empty, as keyboard mash, or in a few
 * seconds. Checked on the server when the learner submits; the paper shows why and what to do.
 */
export type RushGuard = { minAnsweredShare: number; minSecondsPerAnswer: number };

export type SubmitBlock =
  | { reason: "too_few"; needed: number; answered: number; mash: number[] }
  | { reason: "too_fast"; waitSeconds: number };

const VOWELS = new Set("aeiouy");

/** One run of letters that no real answer contains: 20+ letters with no space, 6+ consonants in a row, q without u, or few distinct letters repeated. */
function mashWord(w: string): boolean {
  if (w.length < 6) return false; // short letter runs are variables and products like "pqr" or "abc"
  if (w.length >= 20) return true;
  if (/q[^u]/.test(w)) return true;
  let run = 0;
  for (const ch of w) {
    run = VOWELS.has(ch) ? 0 : run + 1;
    if (run >= 6) return true; // "strengths" has 5
  }
  return w.length >= 12 && new Set(w).size / w.length < 0.3;
}

/** A typed answer that looks like random keys ("pojwecxnwdc", "oowieiiwiiwowi…") rather than an attempt. */
export function looksLikeMash(text: string | null | undefined): boolean {
  const words = (text ?? "").toLowerCase().match(/[a-z]+/g) ?? [];
  const long = words.filter((w) => w.length >= 6);
  if (!long.length) return false;
  return long.filter(mashWord).length * 2 >= long.length;
}

/** Answered for the rush guard: a chosen option, or typed text that isn't blank or mash. */
export function isRealAnswer(q: PaperQuestion, a: AnswerValue | undefined): boolean {
  if (!a) return false;
  if (q.type === "multiple_choice") return a.chosenOption !== null;
  const t = (a.text ?? "").trim();
  return !!t && !looksLikeMash(t);
}

/** Why this paper can't be handed in yet, or null when it can (always null when the guard is off). */
export function submitBlock(
  questions: PaperQuestion[],
  answers: Record<string, AnswerValue | undefined>,
  startedAt: Date | null,
  now: Date,
  guard: RushGuard | null = rules.rushGuard,
): SubmitBlock | null {
  if (!guard) return null;
  const needed = Math.ceil(questions.length * guard.minAnsweredShare);
  const real = questions.filter((q) => isRealAnswer(q, answers[q.id])).length;
  if (real < needed) {
    const mash = questions.flatMap((q, i) => (q.type === "short" && looksLikeMash(answers[q.id]?.text) ? [i + 1] : []));
    return { reason: "too_few", needed, answered: real, mash };
  }
  if (startedAt) {
    const elapsed = (now.getTime() - startedAt.getTime()) / 1000;
    const wait = Math.ceil(real * guard.minSecondsPerAnswer - elapsed);
    if (wait > 0) return { reason: "too_fast", waitSeconds: wait };
  }
  return null;
}

/** What the paper says when it can't be handed in. */
export function blockMessage(b: SubmitBlock): { title: string; body: string } {
  if (b.reason === "too_fast") {
    return {
      title: "Take a little more time",
      body: `Read your answers again before you hand in. You can submit in ${b.waitSeconds} ${b.waitSeconds === 1 ? "second" : "seconds"}.`,
    };
  }
  const mash = b.mash.length
    ? ` ${b.mash.length === 1 ? `Question ${b.mash[0]} looks` : `Questions ${b.mash.slice(0, -1).join(", ")} and ${b.mash[b.mash.length - 1]} look`} like random typing, so ${b.mash.length === 1 ? "it doesn't" : "they don't"} count.`
    : "";
  return {
    title: `Answer at least ${b.needed} questions`,
    body: `You've answered ${b.answered}.${mash} Have a go at the ones you're unsure about: your best try is fine, and it shows what to practise next.`,
  };
}
