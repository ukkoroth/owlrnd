/**
 * Who the AI is talking to in a track chat (0.2 plan, M9): a parent setting up practice for their child, or a
 * self-managed learner setting up their own. The prompts are written for a parent; for a learner, these phrase
 * swaps turn them into "you" for the learner. A test checks that no "parent" or "child" is left.
 */
export type Audience = "parent" | "learner";

const LEARNER_SWAPS: [RegExp, string][] = [
  [/You help a parent set up a "track": a series of short practice exams for their child on one chapter or one upcoming test\./g, 'You help a learner set up a "track": a series of short practice exams for their own exam preparation, on one chapter or one upcoming test or exam.'],
  [/A parent is changing one of their child's practice tracks/g, "A learner is changing one of their own practice tracks"],
  [/at the child's class level/g, "at the level of the exam the learner is preparing for"],
  [/Content must be suitable for school-age children\./g, "Content must be suitable for students."],
  [/latest_parent_message/g, "latest_learner_message"],
  [/The parent's/g, "The learner's"],
  [/the parent's/g, "the learner's"],
  [/The parent/g, "The learner"],
  [/the parent/g, "the learner"],
];

/** The prompt text for this audience. */
export function inVoice(text: string, audience: Audience): string {
  if (audience === "parent") return text;
  return LEARNER_SWAPS.reduce((t, [from, to]) => t.replace(from, to), text);
}

/** How the person chatting is named in the context and the conversation. */
export const speaker = (audience: Audience) => (audience === "parent" ? "Parent" : "Learner");
