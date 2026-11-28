import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { jobs } from "../db/schema";

export type JobType = string;

/** Anything that can insert: the db itself or an open transaction (so a job is queued only if the change commits). */
type Executor = Pick<typeof db, "insert">;

export async function enqueue(type: JobType, payload: unknown, opts: { runAt?: Date; maxAttempts?: number; tx?: Executor } = {}) {
  const [row] = await (opts.tx ?? db)
    .insert(jobs)
    // Without an explicit runAt the database's now() is used, so app and DB clock skew can't delay a job.
    .values({ type, payload, runAt: opts.runAt, maxAttempts: opts.maxAttempts ?? 3 })
    .returning({ id: jobs.id });
  return row!.id;
}

/** Claim the oldest ready job. SKIP LOCKED lets several workers share the table safely. */
export async function claimNext() {
  const result = await db.execute<{ id: string; type: string; payload: unknown; attempts: number; max_attempts: number }>(sql`
    UPDATE jobs SET status = 'running', locked_at = now(), attempts = attempts + 1
    WHERE id = (
      SELECT id FROM jobs
      WHERE status = 'queued' AND run_at <= now()
      ORDER BY run_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, type, payload, attempts, max_attempts
  `);
  return result.rows[0] ?? null;
}

export async function markDone(id: string) {
  await db.update(jobs).set({ status: "done", finishedAt: new Date(), lastError: null }).where(eq(jobs.id, id));
}

/** Retry with backoff (10 s, 40 s, 90 s, …) until maxAttempts, then mark failed. */
export async function markFailed(id: string, attempts: number, maxAttempts: number, error: unknown) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  if (attempts >= maxAttempts) {
    await db.update(jobs).set({ status: "failed", finishedAt: new Date(), lastError: message }).where(eq(jobs.id, id));
  } else {
    const runAt = new Date(Date.now() + 10_000 * attempts * attempts);
    await db.update(jobs).set({ status: "queued", runAt, lockedAt: null, lastError: message }).where(eq(jobs.id, id));
  }
}

/**
 * Jobs left "running" by a crashed or restarted process go back to the queue. At start-up the worker passes 0: the
 * app runs as one container, so every "running" job then belongs to the process that just stopped (a deploy that
 * landed mid-job used to leave it running for ever, and the learner's next exam "being prepared" with it). While
 * running, it sweeps with `rules.jobs.staleMinutes`, longer than any job can take, for a job that hung.
 */
export async function requeueStale(olderThanMinutes: number) {
  await db
    .update(jobs)
    .set({ status: "queued", lockedAt: null })
    .where(and(eq(jobs.status, "running"), sql`${jobs.lockedAt} < now() - make_interval(mins => ${olderThanMinutes})`));
}

export async function jobStatus(id: string) {
  const [row] = await db.select({ status: jobs.status, lastError: jobs.lastError }).from(jobs).where(eq(jobs.id, id));
  return row ?? null;
}

/** Whether a pool top-up for this track is already queued or running, so another isn't added beside it. */
export async function poolJobPending(trackId: string, tx: Pick<typeof db, "select"> = db): Promise<boolean> {
  const rows = await tx
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.type, "write_pool"), inArray(jobs.status, ["queued", "running"]), sql`${jobs.payload}->>'trackId' = ${trackId}`))
    .limit(1);
  return rows.length > 0;
}

/** True while a job of `type` for this track is queued or running (one at a time per track). */
export async function trackJobPending(type: JobType, trackId: string, tx: Pick<typeof db, "select"> = db): Promise<boolean> {
  const rows = await tx
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.type, type), inArray(jobs.status, ["queued", "running"]), sql`${jobs.payload}->>'trackId' = ${trackId}`))
    .limit(1);
  return rows.length > 0;
}
