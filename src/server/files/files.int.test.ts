import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanup, makeParent, makeStudent } from "../../../tests/db-helpers";
import { deleteParent } from "../auth/accounts";
import { db } from "../db";
import { attachments, jobs, trackMessages, tracks } from "../db/schema";
import { deleteFilesJob } from "../jobs/files";
import { removeStudent } from "../students";
import { discardDraft, sendParentTurn } from "../tracks";
import { fileStore } from "./index";

// Release plan, Phase 1 item 3: deleting data also deletes its uploaded files, through a retried job.
beforeAll(() => {
  process.env.OWLRND_FAKE_AI = "1";
});
afterAll(cleanup);

const page = (n: number) => ({ name: `page${n}.png`, type: "image/png", data: Buffer.from(`fake page ${n}`) });
/** Asks the configured store (local disk in tests) whether a file is still there. */
const exists = (key: string) => fileStore().get(key).then(() => true, () => false);
const allExist = async (keys: string[]) => (await Promise.all(keys.map(exists))).every(Boolean);
const noneExist = async (keys: string[]) => !(await Promise.all(keys.map(exists))).some(Boolean);

/** A child with a draft track whose first message carries two photos; returns their file keys. */
async function childWithPhotos(parentId: string) {
  const student = await makeStudent(parentId);
  const res = await sendParentTurn(parentId, student.id, "Physics chapter 12: Ohm's law.", [page(1), page(2)]);
  if (!res.ok) throw new Error(res.error);
  const rows = await db
    .select({ key: attachments.fileKey })
    .from(attachments)
    .innerJoin(trackMessages, eq(trackMessages.id, attachments.trackMessageId))
    .innerJoin(tracks, eq(tracks.id, trackMessages.trackId))
    .where(eq(tracks.studentId, student.id));
  return { student, keys: rows.map((r) => r.key) };
}

/** The delete_files job queued for exactly these keys, removed from the queue so the worker doesn't race the test. */
async function takeDeleteJob(keys: string[]) {
  const rows = await db.select().from(jobs).where(and(eq(jobs.type, "delete_files"), eq(jobs.status, "queued")));
  const job = rows.find((j) => keys.every((k) => (j.payload as { keys: string[] }).keys.includes(k)));
  if (job) await db.delete(jobs).where(eq(jobs.id, job.id));
  return job;
}

describe("uploaded files are deleted with the data they belong to", () => {
  it("deleting a parent account queues every child's files, and the job removes them", async () => {
    const parent = await makeParent();
    const a = await childWithPhotos(parent.id);
    const b = await childWithPhotos(parent.id);
    const keys = [...a.keys, ...b.keys];
    expect(keys).toHaveLength(4);
    expect(await allExist(keys)).toBe(true);

    await deleteParent(parent.id);
    const job = await takeDeleteJob(keys);
    expect(job).toBeDefined();
    expect(job!.maxAttempts).toBe(8);
    expect(await allExist(keys)).toBe(true); // nothing is deleted until the job runs

    await deleteFilesJob(job!.payload);
    expect(await noneExist(keys)).toBe(true);
  });

  it("removing one child deletes only that child's files", async () => {
    const parent = await makeParent();
    const keep = await childWithPhotos(parent.id);
    const gone = await childWithPhotos(parent.id);

    expect(await removeStudent(parent.id, gone.student.id)).toBe(true);
    const job = await takeDeleteJob(gone.keys);
    expect((job!.payload as { keys: string[] }).keys.sort()).toEqual([...gone.keys].sort());
    await deleteFilesJob(job!.payload);
    expect(await noneExist(gone.keys)).toBe(true);
    expect(await allExist(keep.keys)).toBe(true);
  });

  it("removing someone else's child queues nothing", async () => {
    const owner = await makeParent();
    const other = await makeParent();
    const child = await childWithPhotos(owner.id);
    expect(await removeStudent(other.id, child.student.id)).toBe(false);
    expect(await takeDeleteJob(child.keys)).toBeUndefined();
    expect(await allExist(child.keys)).toBe(true);
  });

  it("Start over on a draft queues its files", async () => {
    const parent = await makeParent();
    const { student, keys } = await childWithPhotos(parent.id);
    await discardDraft(parent.id, student.id);
    const job = await takeDeleteJob(keys);
    await deleteFilesJob(job!.payload);
    expect(await noneExist(keys)).toBe(true);
  });

  it("a parent with no uploads queues no job", async () => {
    const parent = await makeParent();
    await makeStudent(parent.id);
    const before = await db.select({ n: sql<number>`count(*)::int` }).from(jobs).where(eq(jobs.type, "delete_files"));
    await deleteParent(parent.id);
    const after = await db.select({ n: sql<number>`count(*)::int` }).from(jobs).where(eq(jobs.type, "delete_files"));
    expect(after[0]!.n).toBe(before[0]!.n);
  });

  it("deleting files that are already gone is not an error (safe to retry)", async () => {
    const { key } = await fileStore().put(Buffer.from("x"), { contentType: "image/png", prefix: "track-material" });
    await deleteFilesJob({ keys: [key] });
    await expect(deleteFilesJob({ keys: [key] })).resolves.toBeUndefined();
  });
});
