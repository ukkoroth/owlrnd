// Test data for integration tests (vitest; can use the app's db module).
import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { parents, students } from "@/server/db/schema";
import type { Actor } from "@/domain/permissions";

/** Permission-policy actors for tests (domain/permissions.ts). */
export const parentActor = (parentId: string): Actor => ({ kind: "parent", parentId });
export const learnerActor = (s: { id: string; type: "self_managed" | "parent_managed"; parentId: string | null }): Actor => ({
  kind: "learner",
  studentId: s.id,
  type: s.type,
  parentId: s.parentId,
});

const created: string[] = [];
const createdLearners: string[] = [];

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

/** A self-managed learner (0.2): signs in with their own email, no parent. */
export async function makeSelfLearner(over: Partial<typeof students.$inferInsert> = {}) {
  const [s] = await db
    .insert(students)
    .values({
      type: "self_managed",
      parentId: null,
      name: "Test Learner",
      email: uniqueEmail("l"),
      emailVerifiedAt: new Date(),
      username: null,
      passwordHash: "x",
      ...over,
    })
    .returning();
  createdLearners.push(s!.id);
  return s!;
}

/** Deletes every parent and self-managed learner made by this file (cascades to students, codes, sessions). */
export async function cleanup() {
  if (created.length) await db.delete(parents).where(inArray(parents.id, created.splice(0)));
  if (createdLearners.length) await db.delete(students).where(inArray(students.id, createdLearners.splice(0)));
}

/** A live track with its first exam written (fake AI), via the real services. */
export async function makeTrackWithExam(parentId: string | Actor, studentId: string, text = "Physics chapter 12: Ohm's law, resistors in series and resistors in parallel.") {
  process.env.OWLRND_FAKE_AI = "1";
  const { sendChatTurn, createTrackFromDraft } = await import("@/server/tracks");
  const { writeExamJob } = await import("@/server/examWriter");
  const actor = typeof parentId === "string" ? parentActor(parentId) : parentId;
  await sendChatTurn(actor, studentId, text, []);
  await sendChatTurn(actor, studentId, "Looks good.", []);
  const res = await createTrackFromDraft(actor, studentId);
  if (!res.ok) throw new Error(res.error);
  await writeExamJob({ trackId: res.trackId }, { attempt: 1, isLastAttempt: true });
  const { exams } = await import("@/server/db/schema");
  const { eq } = await import("drizzle-orm");
  const [exam] = await db.select().from(exams).where(eq(exams.trackId, res.trackId));
  return { trackId: res.trackId, examId: exam!.id };
}
