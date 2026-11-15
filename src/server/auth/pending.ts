import "server-only";
import { rules } from "@/config/rules";
import { hmac, safeEqual } from "./crypto";

/**
 * The step between "password accepted" and "code entered" (and sign-up → verify, forgot → reset).
 * Kept in a short-lived signed cookie, so no table is needed.
 */
export type PendingKind = "sign_in" | "verify_email" | "reset_password";
export type Pending = { kind: PendingKind; parentId: string; studentId: string | null; exp: number };

export function signPending(p: Omit<Pending, "exp">, now = Date.now()): string {
  const payload: Pending = { ...p, exp: now + rules.accounts.pendingStepMinutes * 60_000 };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmac(body)}`;
}

export function readPending(value: string | undefined, kind: PendingKind, now = Date.now()): Pending | null {
  if (!value) return null;
  const [body, sig] = value.split(".");
  if (!body || !sig || !safeEqual(hmac(body), sig)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as Pending;
    return p.kind === kind && p.exp > now ? p : null;
  } catch {
    return null;
  }
}
