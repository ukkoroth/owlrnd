// Test data for integration tests (vitest; can use the app's db module).
import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { parents, students } from "@/server/db/schema";

const created: string[] = [];

export function uniqueEmail(tag = "p") {
  return `${tag}-${randomUUID().slice(0, 8)}@test.owlrnd`;
}

export async function makeParent(over: Partial<typeof parents.$inferInsert> = {}) {
  const [p] = await db
    .insert(parents)
    .values({ name: "Test Parent", email: uniqueEmail(), passwordHash: "x", emailVerifiedAt: new Date(), ...over })
    .returning();
  created.push(p!.id);
  return p!;
}

export async function makeStudent(parentId: string, over: Partial<typeof students.$inferInsert> = {}) {
  const [s] = await db
    .insert(students)
    .values({ parentId, name: "Test Student", className: "10", username: `s-${randomUUID().slice(0, 8)}`, passwordHash: "x", ...over })
    .returning();
  return s!;
}

/** Deletes every parent made by this file (cascades to students, codes, sessions). */
export async function cleanup() {
  if (created.length) await db.delete(parents).where(inArray(parents.id, created.splice(0)));
}

/** A live track with its first exam written (fake AI), via the real services. */
export async function makeTrackWithExam(parentId: string, studentId: string, text = "Physics chapter 12: Ohm's law, resistors in series and resistors in parallel.") {
  process.env.OWLRND_FAKE_AI = "1";
  const { sendParentTurn, createTrackFromDraft } = await import("@/server/tracks");
  const { writeExamJob } = await import("@/server/examWriter");
  await sendParentTurn(parentId, studentId, text, []);
  await sendParentTurn(parentId, studentId, "Looks good.", []);
  const res = await createTrackFromDraft(parentId, studentId);
  if (!res.ok) throw new Error(res.error);
  await writeExamJob({ trackId: res.trackId }, { attempt: 1, isLastAttempt: true });
  const { exams } = await import("@/server/db/schema");
  const { eq } = await import("drizzle-orm");
  const [exam] = await db.select().from(exams).where(eq(exams.trackId, res.trackId));
  return { trackId: res.trackId, examId: exam!.id };
}
