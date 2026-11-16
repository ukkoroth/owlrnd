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
    /**
     * Signed in until Sign out, or this many hours without use, by account type. 30 days for everyone, as in 0.1
     * (owner, 2026-11-16); kept per type so a shorter time for children on shared computers is a one-line change.
     */
    sessionIdleHours: { parent: 30 * 24, self_managed: 30 * 24, parent_managed: 30 * 24 },
    /** Failed password attempts allowed per username/email before sign-in is paused. */
    signInFailures: { max: 10, windowMinutes: 15 },
    /** The step between password and code (or sign-up and verify) expires after this. */
    pendingStepMinutes: 30,
    /**
     * Ages from the date of birth. A self-managed learner under `adult` needs a parent's consent (editions §2.4,
     * M10). "For me" starts at 13 (owner, 2026-11-16); younger learners are set up by a parent. Children a parent
     * adds are `child.min`–`child.max` years old.
     */
    ages: {
      adult: 18,
      learner: { min: 13, max: 120 },
      child: { min: 3, max: 18 },
      /** False stops every under-18 "For me" sign-up (as before M10). */
      under18SelfSignUp: true,
    },
  },

  /**
   * Requests allowed per client IP address in a fixed window (release plan, Phase 1 item 5). These stop
   * scripted guessing and email flooding; real families stay far below them. Per-account limits (code sends,
   * wrong passwords) still apply on top.
   */
  rateLimits: {
    signIn: { max: 30, windowMinutes: 15 },
    codeEntry: { max: 30, windowMinutes: 15 },
    codeSend: { max: 20, windowMinutes: 60 },
    signUp: { max: 10, windowMinutes: 60 },
    passwordReset: { max: 10, windowMinutes: 60 },
    getAccess: { max: 5, windowMinutes: 60 },
    contact: { max: 5, windowMinutes: 60 },
  },

  /**
   * AI cost controls (release plan, Phase 1 item 4). Daily limits are per family, counted in the family's time zone.
   * The monthly budget itself is the AI_MONTHLY_BUDGET_USD setting, so it can change without a release.
   */
  aiLimits: {
    /** Messages a parent sends in track chats (new tracks and updates) per day. */
    chatTurnsPerDay: 40,
    /** Exams written for all of a family's children per day. */
    examsWrittenPerDay: 20,
    /** The owner is emailed when the month's spend reaches this share of the budget, and again at 100%. */
    budgetWarnAt: 0.8,
    /** While the monthly budget is used up, paused exam writing is retried this often (marking never pauses). */
    budgetRetryMinutes: 60,
    /**
     * AI allowance per account holder for the whole demo (0.2 plan, M7): a running total, not per month. The owner can
     * raise it for one account (parents.ai_limit_usd / students.ai_limit_usd, `npm run ai:allowance`).
     */
    perAccountUsd: 10,
    /** The sidebar tracker turns amber from this share of the allowance, and red at 100%. */
    allowanceWarnAt: 0.8,
  },

  /**
   * Closed beta (docs/release-plan.md, Phase 1 item 1) until 0.2, which opens sign-up on both paths (owner,
   * 2026-11-15). Set inviteOnly back to true to close it again: invitations still work.
   */
  access: {
    inviteOnly: false,
    /** An invitation link works once, for this many days. */
    invitationDays: 14,
  },

  /**
   * Parent consent for under-18 self-managed learners (editions §2.4, M10). The owner chose to let them practise
   * while consent is pending; "block_until_consent" stops practice until the parent agrees.
   */
  consent: {
    under18Mode: "practise_while_pending" as "practise_while_pending" | "block_until_consent",
    /** The link in the parent's email works for this many days; the learner can send a new one. */
    linkDays: 7,
    /** One reminder to the parent if they haven't answered. */
    reminderAfterDays: 3,
    /** With no answer after this many days, practice pauses until the parent agrees. */
    pauseAfterDays: 30,
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
