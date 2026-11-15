import "server-only";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { attachments, students, trackMessages, tracks } from "../db/schema";
import { fileStore } from "../files";
import { enqueue } from "./queue";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Deletes uploaded files in the background, with retries, after their database rows are gone
 * (account deletion, removing a student, "Start over", discarding an update chat).
 * Pass the transaction that deletes the rows, so the job is queued only if the delete commits.
 * The job row lives outside the deleted data, so it survives the cascade.
 */
export async function discardFiles(keys: string[], tx?: Tx) {
  const unique = [...new Set(keys)];
  if (unique.length) await enqueue("delete_files", { keys: unique }, { maxAttempts: 8, tx });
}

export async function deleteFilesJob(payload: unknown) {
  const { keys } = payload as { keys: string[] };
  await fileStore().delete(keys);
}

function keysWhere(tx: Tx, where: ReturnType<typeof eq>) {
  return tx
    .select({ key: attachments.fileKey })
    .from(attachments)
    .innerJoin(trackMessages, eq(trackMessages.id, attachments.trackMessageId))
    .innerJoin(tracks, eq(tracks.id, trackMessages.trackId))
    .innerJoin(students, eq(students.id, tracks.studentId))
    .where(where)
    .then((rows) => rows.map((r) => r.key));
}

/** Every uploaded file belonging to a parent's children (all their tracks). */
export const fileKeysForParent = (tx: Tx, parentId: string) => keysWhere(tx, eq(students.parentId, parentId));
/** Every uploaded file belonging to one child. */
export const fileKeysForStudent = (tx: Tx, studentId: string) => keysWhere(tx, eq(students.id, studentId));
