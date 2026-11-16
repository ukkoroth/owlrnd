import "server-only";
import { eq } from "drizzle-orm";
import { controllerOf, type Holder } from "@/domain/accounts";
import { can, type Action, type Actor } from "@/domain/permissions";
import { db } from "./db";
import { parents, students, tracks } from "./db/schema";

// The server side of the permission policy: every function that reads or changes a learner's data gets the learner
// (and their account holder) from here, so `can` is checked in one place. Ids always come from the session or the
// URL; a refusal looks the same as "not found".

export type Student = typeof students.$inferSelect;
export type Track = typeof tracks.$inferSelect;
export type AuthorizedLearner = { student: Student; holder: Holder };

const isUuid = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

/** A learner with their parent (if parent-managed) and account holder. No permission check. */
export async function loadLearner(studentId: string): Promise<AuthorizedLearner | null> {
  if (!isUuid(studentId)) return null;
  const [row] = await db.select({ student: students, parent: parents }).from(students).leftJoin(parents, eq(parents.id, students.parentId)).where(eq(students.id, studentId));
  if (!row) return null;
  return { student: row.student, holder: controllerOf(row.student, row.parent) };
}

/** The learner, if `actor` may do `action` to them; otherwise null. */
export async function authorizeLearner(actor: Actor, action: Action, studentId: string): Promise<AuthorizedLearner | null> {
  const found = await loadLearner(studentId);
  if (!found || !can(actor, action, found.student)) return null;
  return found;
}

/** The track and its learner, if `actor` may do `action` to the track's learner; otherwise null. Drafts are included. */
export async function authorizeTrack(actor: Actor, action: Action, trackId: string): Promise<(AuthorizedLearner & { track: Track }) | null> {
  if (!isUuid(trackId)) return null;
  const [t] = await db.select().from(tracks).where(eq(tracks.id, trackId));
  if (!t) return null;
  const found = await authorizeLearner(actor, action, t.studentId);
  return found ? { ...found, track: t } : null;
}

/** The learner the actor practises as (learner shell). Null for a parent. */
export async function practisingLearner(actor: Actor): Promise<AuthorizedLearner | null> {
  return actor.kind === "learner" ? authorizeLearner(actor, "practise", actor.studentId) : null;
}
