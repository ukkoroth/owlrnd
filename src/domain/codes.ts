import { rules } from "@/config/rules";

const { digits, ttlMinutes, maxWrongTries, maxSendsPerHour } = rules.accounts.code;

/** A fresh code: always `digits` long, leading zeros allowed. `randomInt(max)` returns 0 ≤ n < max. */
export function generateCode(randomInt: (max: number) => number): string {
  return String(randomInt(10 ** digits)).padStart(digits, "0");
}

/** Accepts "482 913", "482-913" etc. Returns null unless exactly `digits` digits remain. */
export function normalizeCodeInput(input: string): string | null {
  const cleaned = input.replace(/[\s-]/g, "");
  return new RegExp(`^\\d{${digits}}$`).test(cleaned) ? cleaned : null;
}

/** "atticus@example.com" → "a•••@example.com" (screen 3b). */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "•••";
  return `${email[0]}•••${email.slice(at)}`;
}

export function codeExpiry(issuedAt: Date): Date {
  return new Date(issuedAt.getTime() + ttlMinutes * 60_000);
}

export const initialTries = maxWrongTries;

export type CodeState = {
  expiresAt: Date;
  triesLeft: number;
  usedAt: Date | null;
  invalidatedAt: Date | null;
};

export type CodeAttempt =
  | { result: "ok" }
  | { result: "wrong"; triesLeft: number }
  /** Last allowed wrong try: the code is invalidated and a new one must be sent (screen 5f). */
  | { result: "locked" }
  | { result: "expired" }
  | { result: "used" }
  | { result: "invalidated" };

/**
 * Rules §1 Codes: single use, valid for 10 minutes, 3 wrong tries.
 * `matches` is whether the entered code equals this code (compared by the caller, which holds the secret).
 */
export function checkCodeAttempt(code: CodeState, matches: boolean, now: Date): CodeAttempt {
  if (code.usedAt) return { result: "used" };
  if (code.invalidatedAt) return { result: "invalidated" };
  if (now >= code.expiresAt) return { result: "expired" };
  if (matches) return { result: "ok" };
  const triesLeft = code.triesLeft - 1;
  return triesLeft > 0 ? { result: "wrong", triesLeft } : { result: "locked" };
}

/** Rules §1: at most `maxSendsPerHour` codes sent per hour. */
export function canSendCode(sentInLastHour: number): boolean {
  return sentInLastHour < maxSendsPerHour;
}
