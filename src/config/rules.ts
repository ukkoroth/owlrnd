/**
 * Every value marked "(default)" in docs/05-rules.md, as listed in docs/10-decisions.md.
 * The owner may change any of these; keep all rule code reading from here.
 */
export const rules = {
  /** §1 Accounts and sign-in */
  accounts: {
    passwordMinLength: 8,
    code: {
      digits: 6,
      ttlMinutes: 10,
      maxWrongTries: 3,
      maxSendsPerHour: 5,
    },
    /** Owner decision (M1): signed in until Sign out, or this many days without use. */
    sessionIdleDays: 30,
    /** Failed password attempts allowed per username/email before sign-in is paused. */
    signInFailures: { max: 10, windowMinutes: 15 },
    /** The step between password and code (or sign-up and verify) expires after this. */
    pendingStepMinutes: 30,
  },

  /** Closed beta (docs/release-plan.md, Phase 1 item 1). Set inviteOnly to false to open sign-up to everyone. */
  access: {
    inviteOnly: true,
    /** An invitation link works once, for this many days. */
    invitationDays: 14,
  },

  /** §3 Goals: "score X / 10 or better in N exams in a row" */
  goal: {
    defaultThreshold: 8, // X
    defaultRunLength: 3, // N
  },

  /** §2 Tracks */
  track: {
    maxTopics: 12,
    maxNameLength: 80,
  },

  /** Track chat (2e, 2f, 2j) */
  chat: {
    maxFilesPerMessage: 10,
    maxPdfBytes: 15 * 1024 * 1024,
    /** Images are resized in the browser to this long edge before upload. */
    imageMaxEdgePx: 2000,
  },

  /** §4 Building exams */
  exam: {
    maxQuestions: 10,
    /** Owner decision (M3): multiple choice and short answers only in 0.1. */
    types: ["multiple_choice", "short"] as const,
    minMultipleChoiceShare: 0.5,
    /** Share of questions per topic strength in later exams. */
    mix: { needsWork: 0.5, notTested: 0.3, strong: 0.2 },
    revisionQuestionsPerExam: 2,
    /** No identical question within this many exams, unless it is a deliberate retry of a miss. */
    repeatWindowExams: 3,
  },

  /** §4 Topic strength */
  topicStrength: {
    window: 5, // last N questions on the topic
    minAnswered: 3,
    strongShare: 0.8,
  },

  /** §5 Paper layout */
  paper: {
    minFontPx: 16,
  },

  /** §6 Marking */
  marks: {
    multipleChoice: 1,
    short: 1,
    /** Not used in 0.1 (no long answers), kept for later versions. */
    long: { min: 2, max: 3 },
    scoreOutOf: 10,
  },

  /** §7 Suggestions on the Today tab */
  suggestions: {
    max: 3,
    order: ["nearestTestDate", "longestSincePractice", "mostWeakTopics"] as const,
  },

  /** §8 Points and levels */
  points: {
    finishExam: 10,
    perCorrect: 2,
    perCorrectCap: 20,
    perExtraCorrectVsLast: 5,
    weakTopicBecomesStrong: 10,
    perfectBonus: 10,
    streak: { firstExamOfDay: 5, fromDay: 7, firstExamOfDayLong: 10 },
    /** Full points for the first N exams a day; after that only correct answers score. */
    fullPointsExamsPerDay: 5,
    levels: [
      { name: "Explorer", at: 500 },
      { name: "Trailblazer", at: 2_000 },
      { name: "Champion", at: 5_000 },
      { name: "Mastermind", at: 10_000 },
      { name: "All-rounder", at: 20_000 },
    ],
  },

  /** §9 Activity charts */
  activity: {
    barDays: 7,
    gridWeeks: 26,
    /** Shade index for 0, 1, 2, 3 and 4+ exams. */
    maxShade: 4,
  },
} as const;

export type Rules = typeof rules;
