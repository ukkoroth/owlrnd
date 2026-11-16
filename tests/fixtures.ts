// Test data for Playwright: plain SQL (the app's server modules can't load outside Next.js).
import { hash } from "@node-rs/argon2";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local", quiet: true });
// Opened on first use, and again after closeDb() (Playwright runs afterAll hooks when a worker restarts).
let _pool: pg.Pool | null = null;
const pool = new Proxy({} as pg.Pool, {
  get(_t, prop) {
    _pool ??= new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
    const v = (_pool as unknown as Record<string | symbol, unknown>)[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(_pool) : v;
  },
});

export const uid = () => randomUUID().slice(0, 8);

export async function createFamily(opts: { password?: string; studentPassword?: string; studentName?: string } = {}) {
  const tag = uid();
  const parent = { name: `Parent ${tag}`, email: `parent-${tag}@test.owlrnd`, password: opts.password ?? "parentpass1" };
  const student = { name: opts.studentName ?? "Scout", username: `scout.${tag}`, password: opts.studentPassword ?? "practice1" };
  const { rows } = await pool.query(
    `insert into parents (name, email, password_hash, email_verified_at) values ($1, $2, $3, now()) returning id`,
    [parent.name, parent.email, await hash(parent.password)],
  );
  const parentId = rows[0].id as string;
  const st = await pool.query(`insert into students (parent_id, name, class_name, username, password_hash) values ($1, $2, 'Class 10', $3, $4) returning id`, [
    parentId,
    student.name,
    student.username,
    await hash(student.password),
  ]);
  return { parentId, studentId: st.rows[0].id as string, parent, student };
}

/** A self-managed learner (0.2): signs in with their own email, which receives their codes. */
export async function createSelfLearner(opts: { password?: string; name?: string; dateOfBirth?: string } = {}) {
  const tag = uid();
  const learner = { name: opts.name ?? `Learner ${tag}`, email: `learner-${tag}@test.owlrnd`, password: opts.password ?? "learnerpass1" };
  const { rows } = await pool.query(
    `insert into students (type, parent_id, name, email, email_verified_at, password_hash, date_of_birth) values ('self_managed', null, $1, $2, now(), $3, $4) returning id`,
    [learner.name, learner.email, await hash(learner.password), opts.dateOfBirth ?? null],
  );
  return { studentId: rows[0].id as string, learner };
}

/** Moves a learner's consent requests `days` into the past (to test the 30-day pause). */
export async function ageConsentRequests(studentId: string, days: number) {
  await pool.query(`update consent_requests set created_at = created_at - ($2 || ' days')::interval where student_id = $1`, [studentId, String(days)]);
}

export async function deleteSelfLearner(studentId: string) {
  await pool.query(`delete from students where id = $1 and type = 'self_managed'`, [studentId]);
}

/** A self-managed learner by email, as sign-up stored them (or null). */
export async function learnerByEmail(
  email: string,
): Promise<{ id: string; type: string; dateOfBirth: string | null; emailVerifiedAt: Date | null; consentVersion: string | null } | null> {
  const { rows } = await pool.query(
    `select id, type, to_char(date_of_birth, 'YYYY-MM-DD') as "dateOfBirth", email_verified_at as "emailVerifiedAt", consent_version as "consentVersion"
       from students where lower(email) = lower($1)`,
    [email],
  );
  return rows[0] ?? null;
}

export async function deleteLearnerByEmail(email: string) {
  await pool.query(`delete from students where lower(email) = lower($1) and type = 'self_managed'`, [email]);
}

/** A child's date of birth as stored ("YYYY-MM-DD"), by username. */
export async function childDateOfBirth(username: string): Promise<string | null> {
  const { rows } = await pool.query(`select to_char(date_of_birth, 'YYYY-MM-DD') as dob from students where lower(username) = lower($1)`, [username]);
  return rows[0]?.dob ?? null;
}

/**
 * AI spend recorded against an account holder (a family, or a self-managed learner), as one usage row. Dated in
 * January 2020: the allowance counts all time, and this keeps test spend out of the real month's budget.
 */
export async function addAiSpend(holder: { parentId: string } | { studentId: string }, usd: number) {
  const parentId = "parentId" in holder ? holder.parentId : null;
  const studentId = "studentId" in holder ? holder.studentId : null;
  await pool.query(
    `insert into ai_usage (parent_id, student_id, purpose, model, input_tokens, output_tokens, cost_usd, created_at) values ($1, $2, 'track_chat', 'claude-opus-5-5', 0, 0, $3, '2020-01-15')`,
    [parentId, studentId, usd],
  );
}

export async function deleteParentByEmail(email: string) {
  await pool.query(`delete from parents where lower(email) = lower($1)`, [email]);
  await pool.query(`delete from invitations where lower(email) = lower($1)`, [email]);
  await pool.query(`delete from access_requests where lower(email) = lower($1)`, [email]);
}

/** A closed-beta invitation (as `npm run invite` makes it, without the email). Returns the sign-up path. */
export async function createInvitation(email: string, { expiresInDays = 14 } = {}) {
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("base64url");
  await pool.query(`insert into invitations (email, token_hash, expires_at) values ($1, $2, now() + ($3 || ' days')::interval)`, [email, hash, String(expiresInDays)]);
  return `/sign-up?invite=${token}`;
}

export async function consentFor(email: string): Promise<{ consentedAt: Date | null; consentVersion: string | null } | null> {
  const { rows } = await pool.query(`select consented_at as "consentedAt", consent_version as "consentVersion" from parents where lower(email) = lower($1)`, [email]);
  return rows[0] ?? null;
}

export async function accessRequestFor(email: string): Promise<{ name: string; note: string | null; status: string } | null> {
  const { rows } = await pool.query(`select name, note, status from access_requests where lower(email) = lower($1)`, [email]);
  return rows[0] ?? null;
}

/** The attachments stored in a student's track chats (name and type), oldest first. */
export async function attachmentsFor(studentId: string): Promise<{ name: string; mediaType: string }[]> {
  const { rows } = await pool.query(
    `select a.original_name as name, a.media_type as "mediaType" from attachments a
       join track_messages m on m.id = a.track_message_id join tracks t on t.id = m.track_id
      where t.student_id = $1 order by a.created_at`,
    [studentId],
  );
  return rows;
}

export async function closeDb() {
  const p = _pool;
  _pool = null;
  await p?.end();
}

export type FixtureQuestion = { type: "multiple_choice" | "short"; prompt: string; options?: string[]; correct?: number; expected?: string; explanation?: string };

/** An active track with one ready exam, written straight to the database (no AI). */
export async function createTrackWithExam(
  studentId: string,
  opts: {
    name?: string;
    status?: "active" | "paused" | "goal_reached";
    testDate?: string | null;
    questions?: FixtureQuestion[];
    goal?: { threshold: number; runLength: number };
    topicNames?: string[];
    /** Extra topics with no questions in exam 1, so they stay untested (goal coverage, rules §3). */
    untestedTopics?: string[];
  } = {},
) {
  const qs =
    opts.questions ??
    Array.from({ length: 10 }, (_, i): FixtureQuestion =>
      i < 6
        ? { type: "multiple_choice", prompt: `Question ${i + 1}: what is the unit of resistance?`, options: ["Ohm", "Volt", "Ampere", "Watt"], correct: 0 }
        : { type: "short", prompt: `Question ${i + 1}: name the law that links V, I and R.`, expected: "Ohm's law" },
    );
  const { rows: tr } = await pool.query(
    `insert into tracks (student_id, name, status, test_date, test_label, goal_threshold, goal_run_length, next_exam, activated_at, color_index)
     values ($1, $2, $3, $4, 'unit test', $5, $6, 'ready', now(), (select count(*) % 8 from tracks where student_id = $1)) returning id`,
    [studentId, opts.name ?? "Physics: Current electricity", opts.status ?? "active", opts.testDate ?? null, opts.goal?.threshold ?? 8, opts.goal?.runLength ?? 3],
  );
  const trackId = tr[0].id as string;
  const names = opts.topicNames ?? ["Ohm's law"];
  const tp: { id: string }[] = [];
  for (const [i, name] of names.entries()) {
    const { rows } = await pool.query(`insert into topics (track_id, name, position) values ($1, $2, $3) returning id`, [trackId, name, i]);
    tp.push(rows[0]);
  }
  const { rows: ex } = await pool.query(`insert into exams (student_id, track_id, number, status) values ($1, $2, 1, 'ready') returning id`, [studentId, trackId]);
  const examId = ex[0].id as string;
  for (const [i, name] of (opts.untestedTopics ?? []).entries()) {
    await pool.query(`insert into topics (track_id, name, position) values ($1, $2, $3)`, [trackId, name, names.length + i]);
  }
  for (const [i, q] of qs.entries()) {
    const { rows } = await pool.query(
      `insert into questions (track_id, topic_id, type, prompt, options, correct_option, expected_answer, difficulty, explanation)
       values ($1, $2, $3, $4, $5, $6, $7, 2, $8) returning id`,
      [trackId, tp[i % tp.length]!.id, q.type, q.prompt, JSON.stringify(q.options ?? []), q.correct ?? null, q.expected ?? null, q.explanation ?? `SECRET-EXPLANATION-${i + 1}`],
    );
    await pool.query(`insert into exam_questions (exam_id, question_id, position) values ($1, $2, $3)`, [examId, rows[0].id, i + 1]);
  }
  return { trackId, examId };
}
