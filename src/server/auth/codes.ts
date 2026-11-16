import "server-only";
import { and, count, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { canSendCode, checkCodeAttempt, codeExpiry, generateCode, initialTries, normalizeCodeInput } from "@/domain/codes";
import { rules } from "@/config/rules";
import { db } from "../db";
import { codes } from "../db/schema";
import { getParent } from "./accounts";
import { loadLearner } from "../learners";
import { emailSender, type CodePurpose } from "../email";
import { hmac, randomInt, safeEqual } from "./crypto";

/**
 * Codes are scoped to who they are for: a student's sign-in code never cancels the parent's, or a sibling's.
 * A parent's own code: { parentId, studentId: null }. A child's: { parentId, studentId }. A self-managed learner's:
 * { parentId: null, studentId }.
 */
export type CodeOwner = { parentId: string | null; studentId: string | null; purpose: CodePurpose };

const ownerWhere = (o: CodeOwner) =>
  and(
    o.parentId ? eq(codes.parentId, o.parentId) : isNull(codes.parentId),
    o.studentId ? eq(codes.studentId, o.studentId) : isNull(codes.studentId),
    eq(codes.purpose, o.purpose),
  );

/**
 * Who receives the code (rules §1, editions §2.3): the account holder. A parent's code and a child's code go to the
 * parent; a self-managed learner's goes to the learner. `studentName` is set when the code is for someone else.
 */
export async function codeRecipient(owner: Omit<CodeOwner, "purpose">): Promise<{ name: string; email: string; studentName?: string; selfManaged?: boolean }> {
  if (owner.studentId) {
    const learner = await loadLearner(owner.studentId);
    if (!learner) throw new Error("issueCode: student not found");
    if ((learner.student.parentId ?? null) !== owner.parentId) throw new Error("issueCode: owner doesn't match the student");
    const { holder, student } = learner;
    return holder.kind === "parent" ? { name: holder.name, email: holder.email, studentName: student.name } : { name: holder.name, email: holder.email, selfManaged: true };
  }
  if (!owner.parentId) throw new Error("issueCode: no owner");
  const parent = await getParent(owner.parentId);
  if (!parent) throw new Error("issueCode: parent not found");
  return { name: parent.name, email: parent.email };
}

export type IssueResult = { sent: true; sentTo: string } | { sent: false; reason: "rate_limited" };

/**
 * Send a new code (rules §1): invalidates earlier unused codes for the same owner and purpose,
 * allows at most 5 sends an hour, and emails the account holder (or the new address, for an email change).
 */
export async function issueCode(owner: CodeOwner & { newEmail?: string }, now = new Date()): Promise<IssueResult> {
  const { name, email, studentName, selfManaged } = await codeRecipient(owner);
  const sentTo = owner.purpose === "change_email" ? owner.newEmail! : email;
  const code = generateCode(randomInt);

  const issued = await db.transaction(async (tx) => {
    // Serialise sends for this owner so the hourly limit can't be raced.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${owner.parentId ?? "-"}:${owner.studentId ?? "-"}:${owner.purpose}`}))`);

    const hourAgo = new Date(now.getTime() - 60 * 60_000);
    const [{ n } = { n: 0 }] = await tx
      .select({ n: count() })
      .from(codes)
      .where(and(ownerWhere(owner), gt(codes.createdAt, hourAgo)));
    if (!canSendCode(n)) return false;

    await tx
      .update(codes)
      .set({ invalidatedAt: now })
      .where(and(ownerWhere(owner), isNull(codes.usedAt), isNull(codes.invalidatedAt)));

    await tx.insert(codes).values({
      parentId: owner.parentId,
      studentId: owner.studentId,
      purpose: owner.purpose,
      codeHash: hmac(code),
      sentTo,
      newEmail: owner.newEmail ?? null,
      expiresAt: codeExpiry(now),
      triesLeft: initialTries,
      createdAt: now,
    });
    return true;
  });

  if (!issued) return { sent: false, reason: "rate_limited" };

  await emailSender().sendCode({
    to: sentTo,
    parentName: name,
    selfManaged,
    purpose: owner.purpose,
    code,
    studentName,
    ttlMinutes: rules.accounts.code.ttlMinutes,
  });
  return { sent: true, sentTo };
}

export type VerifyResult =
  | { result: "ok"; newEmail: string | null }
  | { result: "wrong"; triesLeft: number }
  /** 3rd wrong try: the code is gone; a new one was sent unless the hourly limit was reached. */
  | { result: "locked"; newCodeSent: boolean }
  | { result: "expired" | "used" | "invalidated" | "no_code" | "malformed" };

/** Check an entered code against the owner's latest code. Every state change is a single conditional UPDATE. */
export async function verifyCode(owner: CodeOwner, input: string, now = new Date()): Promise<VerifyResult> {
  const entered = normalizeCodeInput(input);
  if (!entered) return { result: "malformed" };

  const [latest] = await db.select().from(codes).where(ownerWhere(owner)).orderBy(desc(codes.createdAt)).limit(1);
  if (!latest) return { result: "no_code" };

  const attempt = checkCodeAttempt(latest, safeEqual(hmac(entered), latest.codeHash), now);
  const stillOpen = and(eq(codes.id, latest.id), isNull(codes.usedAt), isNull(codes.invalidatedAt), gt(codes.triesLeft, 0));

  switch (attempt.result) {
    case "ok": {
      const claimed = await db.update(codes).set({ usedAt: now }).where(stillOpen).returning({ id: codes.id });
      return claimed.length ? { result: "ok", newEmail: latest.newEmail } : { result: "used" };
    }
    case "wrong":
    case "locked": {
      const [row] = await db
        .update(codes)
        .set({
          triesLeft: sql`${codes.triesLeft} - 1`,
          invalidatedAt: sql`case when ${codes.triesLeft} - 1 <= 0 then ${now.toISOString()}::timestamptz else null end`,
        })
        .where(stillOpen)
        .returning({ triesLeft: codes.triesLeft });
      if (!row) return { result: "invalidated" };
      if (row.triesLeft > 0) return { result: "wrong", triesLeft: row.triesLeft };
      const reissued = await issueCode({ ...owner, newEmail: latest.newEmail ?? undefined }, now);
      return { result: "locked", newCodeSent: reissued.sent };
    }
    default:
      return attempt;
  }
}

/**
 * The address an email change is waiting to confirm (latest change_email code still open), if any.
 * `owner` is the account changing its email: a parent ({ parentId, studentId: null }) or a self-managed learner.
 */
export async function pendingNewEmail(owner: Omit<CodeOwner, "purpose">, now = new Date()): Promise<string | null> {
  const [latest] = await db
    .select({ newEmail: codes.newEmail, usedAt: codes.usedAt, expiresAt: codes.expiresAt })
    .from(codes)
    .where(ownerWhere({ ...owner, purpose: "change_email" }))
    .orderBy(desc(codes.createdAt))
    .limit(1);
  // An expired or locked code still names the address, so "Send a new code" keeps working; a used one doesn't.
  if (!latest || latest.usedAt || now.getTime() - latest.expiresAt.getTime() > 60 * 60_000) return null;
  return latest.newEmail;
}
