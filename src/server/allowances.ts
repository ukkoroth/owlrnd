import "server-only";
import { eq, sql } from "drizzle-orm";
import { holderForParent, type Holder } from "@/domain/accounts";
import { allowanceOf } from "./ai/usage";
import { findParentByEmail, findSelfManagedByEmail } from "./auth/accounts";
import { db } from "./db";
import { parents, students } from "./db/schema";
import { loadLearner } from "./learners";

/** The account holder who signs in with this email: a parent or a self-managed learner (one email, one account). */
export async function holderByEmail(email: string): Promise<Holder | null> {
  const parent = await findParentByEmail(email);
  if (parent) return holderForParent(parent);
  const learner = await findSelfManagedByEmail(email);
  return learner ? ((await loadLearner(learner.id))?.holder ?? null) : null;
}

/**
 * The owner raises (or resets, with null) one account's AI allowance, e.g. after they buy a package
 * (rules.aiLimits.perAccountUsd is the default). Returns the account's allowance afterwards, or null if not found.
 */
export async function setAllowanceLimit(email: string, limitUsd: number | null) {
  const holder = await holderByEmail(email);
  if (!holder) return null;
  if (holder.kind === "parent") await db.update(parents).set({ aiLimitUsd: limitUsd }).where(eq(parents.id, holder.parentId));
  else await db.update(students).set({ aiLimitUsd: limitUsd }).where(eq(students.id, holder.studentId));
  return { holder, allowance: await allowanceOf({ ...holder, aiLimitUsd: limitUsd }) };
}

/** Every account with an owner-set limit, for `allowance list`. */
export async function customAllowances() {
  const ps = await db.select({ email: parents.email, limit: parents.aiLimitUsd }).from(parents).where(sql`${parents.aiLimitUsd} is not null`);
  const ls = await db.select({ email: students.email, limit: students.aiLimitUsd }).from(students).where(sql`${students.aiLimitUsd} is not null`);
  return [...ps, ...ls];
}
