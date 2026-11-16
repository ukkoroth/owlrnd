import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, jsonb, numeric, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { StoredPreview, StoredUpdate } from "@/domain/tracks";

// Tables from docs/06-data.md, added milestone by milestone.

export const jobStatus = pgEnum("job_status", ["queued", "running", "done", "failed"]);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull().$type<unknown>(),
    status: jobStatus("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("jobs_ready_idx").on(t.status, t.runAt)],
);

// ── M1 · Accounts ───────────────────────────────────────────────────────────

export const parents = pgTable(
  "parents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    passwordHash: text("password_hash").notNull(),
    timeZone: text("time_zone").notNull().default("UTC"),
    /** Sign-up consent: the parent confirmed they are the children's parent or guardian and agreed to the policies. */
    consentedAt: timestamp("consented_at", { withTimezone: true }),
    /** Which version of the terms and privacy policy they agreed to (config/legal.ts). */
    consentVersion: text("consent_version"),
    /** The owner's override of the AI allowance for this family (rules.aiLimits.perAccountUsd when null). */
    aiLimitUsd: numeric("ai_limit_usd", { precision: 10, scale: 2, mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("parents_email_unique").on(sql`lower(${t.email})`)],
);

/** 0.2 (editions §2.3): who controls a learner. Self-managed learners control themselves; parent-managed, their parent. */
export const learnerType = pgEnum("learner_type", ["self_managed", "parent_managed"]);

export const students = pgTable(
  "students",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: learnerType("type").notNull().default("parent_managed"),
    /** Set exactly when the learner is parent-managed. */
    parentId: uuid("parent_id").references(() => parents.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    className: text("class_name").notNull().default(""),
    /** Parent-managed learners sign in with a username. */
    username: text("username"),
    /** Self-managed learners sign in with their email, which receives their codes. */
    email: text("email"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    dateOfBirth: date("date_of_birth", { mode: "string" }),
    /** Self-managed sign-up consent (as parents.consented_at). */
    consentedAt: timestamp("consented_at", { withTimezone: true }),
    consentVersion: text("consent_version"),
    /** The owner's override of a self-managed learner's AI allowance (rules.aiLimits.perAccountUsd when null). */
    aiLimitUsd: numeric("ai_limit_usd", { precision: 10, scale: 2, mode: "number" }),
    passwordHash: text("password_hash").notNull(),
    timeZone: text("time_zone").notNull().default("UTC"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("students_username_unique").on(sql`lower(${t.username})`),
    uniqueIndex("students_email_unique").on(sql`lower(${t.email})`),
    index("students_parent_idx").on(t.parentId),
    check("students_parent_by_type", sql`(${t.type} = 'parent_managed') = (${t.parentId} is not null)`),
    check(
      "students_sign_in_by_type",
      sql`(${t.type} = 'parent_managed' and ${t.username} is not null) or (${t.type} = 'self_managed' and ${t.email} is not null)`,
    ),
  ],
);

export const parentLinkKind = pgEnum("parent_link_kind", ["manages", "consents"]);
export const parentLinkStatus = pgEnum("parent_link_status", ["active", "pending", "declined", "ended"]);

/**
 * Parent ↔ learner (editions §3). "manages": a parent-managed child (students.parent_id is the fast path).
 * "consents": a parent consenting for an under-18 self-managed learner (M10).
 */
export const parentLinks = pgTable(
  "parent_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentId: uuid("parent_id")
      .notNull()
      .references(() => parents.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    kind: parentLinkKind("kind").notNull(),
    status: parentLinkStatus("status").notNull().default("active"),
    /** "email_code" in 0.2; "manual" and "digilocker" later (roadmap items 13, 14). */
    verificationLevel: text("verification_level"),
    givenAt: timestamp("given_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("parent_links_unique").on(t.parentId, t.studentId, t.kind), index("parent_links_student_idx").on(t.studentId)],
);

export const codePurpose = pgEnum("code_purpose", ["verify_email", "sign_in", "reset_password", "change_email"]);

export const codes = pgTable(
  "codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** The parent's own codes, and their children's (with studentId). Null for a self-managed learner's codes. */
    parentId: uuid("parent_id").references(() => parents.id, { onDelete: "cascade" }),
    /** Set when the code was requested for a student (sign-in or reset). */
    studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }),
    purpose: codePurpose("purpose").notNull(),
    codeHash: text("code_hash").notNull(),
    sentTo: text("sent_to").notNull(),
    /** change_email only: the address being confirmed. */
    newEmail: text("new_email"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    triesLeft: integer("tries_left").notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    invalidatedAt: timestamp("invalidated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("codes_owner_idx").on(t.parentId, t.purpose, t.createdAt),
    index("codes_student_idx").on(t.studentId, t.purpose, t.createdAt),
    check("codes_has_owner", sql`${t.parentId} is not null or ${t.studentId} is not null`),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull().unique(),
    parentId: uuid("parent_id").references(() => parents.id, { onDelete: "cascade" }),
    studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [check("sessions_one_owner", sql`(${t.parentId} is null) <> (${t.studentId} is null)`)],
);

export const signInFailures = pgTable(
  "sign_in_failures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identifier: text("identifier").notNull(),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sign_in_failures_idx").on(t.identifier, t.createdAt)],
);

// ── AI cost controls ────────────────────────────────────────────────────────

export const aiPurpose = pgEnum("ai_purpose", ["track_chat", "track_update", "write_exam", "mark_answers"]);

/**
 * One row per Claude call, with its estimated cost. The family link is cleared if the account is deleted, so the
 * month's spend stays correct without keeping anything personal.
 */
export const aiUsage = pgTable(
  "ai_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentId: uuid("parent_id").references(() => parents.id, { onDelete: "set null" }),
    /** The learner the call was for; for a self-managed learner (no parent) this is the account holder. */
    studentId: uuid("student_id").references(() => students.id, { onDelete: "set null" }),
    purpose: aiPurpose("purpose").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
    cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 12, scale: 6, mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ai_usage_created_idx").on(t.createdAt),
    index("ai_usage_parent_idx").on(t.parentId, t.createdAt),
    index("ai_usage_student_idx").on(t.studentId, t.createdAt),
  ],
);

/** Budget emails already sent, so each goes once per month ("2026-11", "warn" | "reached"). */
export const aiBudgetAlerts = pgTable(
  "ai_budget_alerts",
  {
    month: text("month").notNull(),
    level: text("level").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.month, t.level] })],
);

/** Requests per client IP and action in fixed windows (rules.rateLimits). Old windows are pruned as new ones start. */
export const rateLimitHits = pgTable(
  "rate_limit_hits",
  {
    bucket: text("bucket").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.bucket, t.windowStart] })],
);

// ── Closed beta · access requests and invitations ──────────────────────────

export const accessRequestStatus = pgEnum("access_request_status", ["pending", "invited"]);

/** Someone asked for access from the landing page. One row per email; asking again updates it. */
export const accessRequests = pgTable(
  "access_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    note: text("note"),
    status: accessRequestStatus("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("access_requests_email_unique").on(sql`lower(${t.email})`)],
);

/**
 * A sign-up link sent by the owner. The token is stored hashed. Sign-up (1a) attaches the unverified parent;
 * verifying the email (1b) uses the invitation up.
 */
export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    claimedByParentId: uuid("claimed_by_parent_id").references(() => parents.id, { onDelete: "set null" }),
    /** 0.2: a self-managed learner who signed up with this invitation. */
    claimedByStudentId: uuid("claimed_by_student_id").references(() => students.id, { onDelete: "set null" }),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("invitations_email_idx").on(sql`lower(${t.email})`)],
);

// ── M3 · Tracks, questions, exams ──────────────────────────────────────────

export const trackStatus = pgEnum("track_status", ["draft", "active", "paused", "goal_reached", "archived"]);
export const nextExamState = pgEnum("next_exam_state", ["none", "writing", "ready", "failed"]);

export const tracks = pgTable(
  "tracks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    /** Null while the track is a draft (the chat is still going). */
    name: text("name"),
    status: trackStatus("status").notNull().default("draft"),
    testDate: date("test_date", { mode: "string" }),
    testLabel: text("test_label"),
    goalThreshold: integer("goal_threshold"),
    goalRunLength: integer("goal_run_length"),
    goalProgress: integer("goal_progress").notNull().default(0),
    /** Goal progress counts only exams numbered above this (set when the goal is restarted, rules §3). */
    goalSinceExam: integer("goal_since_exam").notNull().default(0),
    goalReachedAt: timestamp("goal_reached_at", { withTimezone: true }),
    /** Parent preferences agreed in the chat, e.g. "more calculations on parallel circuits". */
    focusNotes: text("focus_notes"),
    nextExam: nextExamState("next_exam").notNull().default("none"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
  },
  (t) => [index("tracks_student_idx").on(t.studentId, t.status)],
);

export const topics = pgTable(
  "topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trackId: uuid("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    position: integer("position").notNull(),
    addedInMessageId: uuid("added_in_message_id"),
    revisionOnly: boolean("revision_only").notNull().default(false),
  },
  (t) => [index("topics_track_idx").on(t.trackId, t.position)],
);

export const messageAuthor = pgEnum("message_author", ["parent", "ai", "learner"]);
/** "create": the chat that made the track (2e/2f). "extend": later chats that add topics or material (2j, Add material). */
export const messageKind = pgEnum("message_kind", ["create", "extend"]);

export const trackMessages = pgTable(
  "track_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trackId: uuid("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    author: messageAuthor("author").notNull(),
    kind: messageKind("kind").notNull().default("create"),
    text: text("text").notNull(),
    /** AI turns of the create chat: the track preview as agreed so far. */
    preview: jsonb("preview").$type<StoredPreview>(),
    /** AI turns of an extend chat: the proposed update, and whether it was applied. */
    update: jsonb("update").$type<StoredUpdate>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("track_messages_track_idx").on(t.trackId, t.createdAt)],
);

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** "track_message" in 0.1; answer uploads (0.15) add another owner type with its own FK column. */
    ownerType: text("owner_type").notNull(),
    /** Owner for "track_message"; the FK cascade removes rows when a track, student or parent is deleted. */
    trackMessageId: uuid("track_message_id").references(() => trackMessages.id, { onDelete: "cascade" }),
    fileKey: text("file_key").notNull(),
    mediaType: text("media_type").notNull(),
    originalName: text("original_name").notNull(),
    /** What the AI read on it, e.g. "Page 142". */
    label: text("label"),
    extractedText: text("extracted_text"),
    unreadable: boolean("unreadable").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("attachments_track_message_idx").on(t.trackMessageId)],
);

export const questionType = pgEnum("question_type", ["multiple_choice", "short"]);

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trackId: uuid("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    type: questionType("type").notNull(),
    prompt: text("prompt").notNull(),
    options: jsonb("options").$type<string[]>().notNull().default([]),
    correctOption: integer("correct_option"),
    expectedAnswer: text("expected_answer"),
    marks: integer("marks").notNull().default(1),
    difficulty: integer("difficulty").notNull(),
    explanation: text("explanation").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("questions_track_idx").on(t.trackId, t.topicId)],
);

export const examStatus = pgEnum("exam_status", ["ready", "in_progress", "submitted", "marking", "marked"]);

export const exams = pgTable(
  "exams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    trackId: uuid("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    status: examStatus("status").notNull().default("ready"),
    score: integer("score"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    markedAt: timestamp("marked_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("exams_track_number_unique").on(t.trackId, t.number), index("exams_student_idx").on(t.studentId, t.status)],
);

export const examQuestions = pgTable(
  "exam_questions",
  {
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
  },
  (t) => [primaryKey({ columns: [t.examId, t.position] })],
);

// ── M4 · Answers ───────────────────────────────────────────────────────────

export const answers = pgTable(
  "answers",
  {
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    /** Multiple choice: 0–3. */
    chosenOption: integer("chosen_option"),
    /** Short answer: what the student typed. */
    text: text("text"),
    savedAt: timestamp("saved_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.examId, t.questionId] })],
);

// ── M5 · Marking, topic strength, points ───────────────────────────────────

export const verdict = pgEnum("verdict", ["correct", "missed"]);
export const markedBy = pgEnum("marked_by", ["rule", "ai"]);

export const marks = pgTable(
  "marks",
  {
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    marksAwarded: integer("marks_awarded").notNull(),
    verdict: verdict("verdict").notNull(),
    /** One line for the student about a miss (from the AI for short answers). */
    reason: text("reason"),
    markedBy: markedBy("marked_by").notNull(),
  },
  (t) => [primaryKey({ columns: [t.examId, t.questionId] })],
);

/** One row per marked question; topic strength comes from each topic's last 5 rows (rules §4). */
export const topicResults = pgTable(
  "topic_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    correct: boolean("correct").notNull(),
    answeredAt: timestamp("answered_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("topic_results_topic_idx").on(t.studentId, t.topicId, t.answeredAt)],
);

export const pointsKind = pgEnum("points_kind", ["finish", "correct", "improvement", "topic_strong", "perfect", "streak"]);

/** Points only add up (rules §8): the total is the sum of these rows. */
export const pointsEvents = pgTable(
  "points_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    kind: pointsKind("kind").notNull(),
    points: integer("points").notNull(),
    label: text("label").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("points_events_student_idx").on(t.studentId, t.createdAt)],
);
