import { inArray, like, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "../db";
import { jobs } from "../db/schema";
import { claimNext, enqueue, jobStatus, markDone, markFailed } from "./queue";

// Runs against the docker Postgres (npm run db:up). Uses its own job type and cleans up after itself.
const TYPE = `test-${process.pid}`;

afterAll(async () => {
  await db.delete(jobs).where(like(jobs.type, "test-%"));
});

/** Claim until we get one of our own jobs (ignores anything else that is queued). */
async function claimOurs() {
  for (;;) {
    const job = await claimNext();
    if (!job || job.type === TYPE) return job;
  }
}

describe("job queue", () => {
  it("claims a ready job once, then marks it done", async () => {
    const id = await enqueue(TYPE, { n: 1 });
    const job = await claimOurs();
    expect(job).toMatchObject({ id, type: TYPE, payload: { n: 1 }, attempts: 1 });
    expect((await jobStatus(id))?.status).toBe("running");
    await markDone(id);
    expect((await jobStatus(id))?.status).toBe("done");
  });

  it("does not claim a job before its runAt", async () => {
    const id = await enqueue(TYPE, {}, { runAt: new Date(Date.now() + 60_000) });
    expect(await claimOurs()).toBeNull();
    await db.delete(jobs).where(inArray(jobs.id, [id]));
  });

  it("requeues with backoff, then fails after maxAttempts", async () => {
    const id = await enqueue(TYPE, {}, { maxAttempts: 2 });
    const first = await claimOurs();
    await markFailed(id, first!.attempts, first!.max_attempts, new Error("boom"));
    expect(await jobStatus(id)).toEqual({ status: "queued", lastError: "Error: boom" });

    await db.update(jobs).set({ runAt: sql`now()` }).where(inArray(jobs.id, [id])); // skip the backoff wait
    const second = await claimOurs();
    expect(second?.attempts).toBe(2);
    await markFailed(id, second!.attempts, second!.max_attempts, new Error("boom again"));
    expect(await jobStatus(id)).toEqual({ status: "failed", lastError: "Error: boom again" });
  });
});
