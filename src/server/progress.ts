import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { strengthOf, type Strength } from "@/domain/topicStrength";
import { db } from "./db";
import { topicResults, topics } from "./db/schema";

export type TopicWithStrength = { id: string; name: string; position: number; strength: Strength; revisionOnly: boolean };

/** Every topic of the given tracks with the student's current strength (rules §4: last 5 answers per topic). */
export async function topicStrengths(studentId: string, trackIds: string[], tx: Pick<typeof db, "select"> = db): Promise<Map<string, TopicWithStrength[]>> {
  const out = new Map<string, TopicWithStrength[]>(trackIds.map((id) => [id, []]));
  if (!trackIds.length) return out;
  const tps = await tx.select().from(topics).where(inArray(topics.trackId, trackIds)).orderBy(asc(topics.position));
  if (!tps.length) return out;
  const rows = await tx
    .select({ topicId: topicResults.topicId, correct: topicResults.correct })
    .from(topicResults)
    .where(and(eq(topicResults.studentId, studentId), inArray(topicResults.topicId, tps.map((t) => t.id))))
    .orderBy(desc(topicResults.answeredAt), desc(topicResults.id));
  const recent = new Map<string, boolean[]>();
  for (const r of rows) {
    const list = recent.get(r.topicId) ?? [];
    if (list.length < 5) list.unshift(r.correct); // oldest first
    recent.set(r.topicId, list);
  }
  for (const t of tps) {
    out.get(t.trackId)!.push({ id: t.id, name: t.name, position: t.position, strength: strengthOf(recent.get(t.id) ?? []), revisionOnly: t.revisionOnly });
  }
  return out;
}
