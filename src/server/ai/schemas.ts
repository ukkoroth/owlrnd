import { z } from "zod";

// Structured-output schemas. Kept to plain types (no min/max), because ranges are enforced by the app afterwards
// (src/domain/tracks.ts, src/domain/examPlan.ts), which also keeps the JSON schema simple for structured outputs.

export const previewSchema = z.object({
  name: z.string().nullable().describe('Track name, "Subject: Chapter or test", e.g. "Physics: Current electricity". Null until known.'),
  topics: z.array(z.object({ name: z.string(), description: z.string().describe("One line.") })),
  testDate: z.string().nullable().describe("YYYY-MM-DD, only if the parent gave a date. Otherwise null."),
  testLabel: z.string().nullable().describe('What the test is called, e.g. "unit test". Null if none.'),
  goal: z.object({ threshold: z.number().int(), runLength: z.number().int() }).nullable(),
  focusNotes: z.string().nullable().describe("Agreed preferences for the questions, in one or two sentences. Null if none."),
});

export const trackChatSchema = z.object({
  reply: z.string().describe("Your message to the parent."),
  extracted: z
    .array(
      z.object({
        attachment: z.number().int().describe("1-based number of the new attachment."),
        label: z.string().nullable().describe('Short label such as "Page 142" or "Syllabus", if visible.'),
        readable: z.boolean(),
        text: z.string().describe("The study content of the attachment, transcribed. Empty if unreadable."),
      }),
    )
    .describe("One entry per NEW attachment in this turn."),
  preview: previewSchema,
  ready: z.boolean().describe("True only when the parent has seen and agreed to the name, topics and goal."),
});
export type TrackChatOutput = z.infer<typeof trackChatSchema>;

export const writtenExamSchema = z.object({
  questions: z.array(
    z.object({
      topicKey: z.string(),
      type: z.enum(["multiple_choice", "short"]),
      prompt: z.string(),
      options: z.array(z.string()).describe("Exactly 4 for multiple choice; empty for short answers."),
      correctIndex: z.number().int().nullable().describe("0-3 for multiple choice; null for short answers."),
      expectedAnswer: z.string().nullable().describe("Short answers: a word or one sentence. Null for multiple choice."),
      explanation: z.string().describe("One line shown on the marked paper."),
      difficulty: z.number().int().describe("1 (easy) to 5 (hard), for this class level."),
    }),
  ),
});
export type WrittenExamOutput = z.infer<typeof writtenExamSchema>;

export const markedAnswersSchema = z.object({
  results: z.array(
    z.object({
      key: z.string().describe("The answer key, e.g. A1."),
      correct: z.boolean(),
      reason: z.string().describe("If wrong: one short, kind sentence to the student saying what was missed. If right: empty."),
    }),
  ),
});
export type MarkedAnswersOutput = z.infer<typeof markedAnswersSchema>;

export const trackUpdateSchema = z.object({
  reply: z.string().describe("Your message to the parent."),
  extracted: z
    .array(
      z.object({
        attachment: z.number().int(),
        label: z.string().nullable(),
        readable: z.boolean(),
        text: z.string(),
      }),
    )
    .describe("One entry per NEW attachment in this turn."),
  update: z.object({
    newTopics: z.array(z.object({ name: z.string(), description: z.string() })).describe("Topics to add. Never repeat the track's current topics."),
    goal: z.object({ threshold: z.number().int(), runLength: z.number().int() }).nullable().describe("The new goal, or null to keep the current goal."),
    testDate: z.string().nullable().describe("YYYY-MM-DD if the parent gave a new test date, else null."),
    testLabel: z.string().nullable(),
  }),
  ready: z.boolean().describe("True only when the parent has seen the proposed change and agreed to it."),
});
export type TrackUpdateOutput = z.infer<typeof trackUpdateSchema>;

/** 0.3 Flashcards: the cards written for a track's deck. */
export const flashcardsSchema = z.object({
  cards: z.array(
    z.object({
      topicKey: z.string(),
      front: z.string().describe("A question or term, one or two lines."),
      answer: z.string().describe("A word, a number with its unit, or one short sentence."),
      explanation: z.string().describe("One or two sentences on why, shown with the answer."),
      missedKey: z.string().nullable().describe("For a card made from a missed exam question: its key (e.g. M1). Otherwise null."),
    }),
  ),
});
export type FlashcardsOutput = z.infer<typeof flashcardsSchema>;
