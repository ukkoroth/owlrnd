import { rules } from "@/config/rules";

export type Identifier = { kind: "email"; value: string } | { kind: "username"; value: string };

/** Sign-in and forgot password take "username or email". Usernames never contain "@". */
export function parseIdentifier(input: string): Identifier | null {
  const value = input.trim();
  if (!value) return null;
  return value.includes("@") ? { kind: "email", value: value.toLowerCase() } : { kind: "username", value: value.toLowerCase() };
}

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function validateEmail(input: string): string | null {
  const email = normalizeEmail(input);
  if (!email) return "Enter your email address.";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter an email address like name@example.com.";
  return null;
}

export function validatePassword(password: string): string | null {
  const min = rules.accounts.passwordMinLength;
  if (password.length < min) return `Use at least ${min} characters.`;
  if (password.length > 200) return "Use at most 200 characters.";
  return null;
}

/** Student usernames (created in M2): letters, digits, dot, dash, underscore; 3–30 characters. */
export function validateUsername(input: string): string | null {
  const username = input.trim();
  if (username.length < 3 || username.length > 30) return "Use 3 to 30 characters.";
  if (!/^[a-zA-Z0-9._-]+$/.test(username)) return "Use letters, numbers, dots, dashes or underscores.";
  return null;
}

export function validateName(input: string): string | null {
  const name = input.trim();
  if (!name) return "Enter a name.";
  if (name.length > 80) return "Use at most 80 characters.";
  return null;
}

export function validateClassName(input: string): string | null {
  const value = input.trim();
  if (!value) return "Enter the class, for example Class 10.";
  if (value.length > 40) return "Use at most 40 characters.";
  return null;
}

/** "10" and "Class 10" both show as "Class 10"; anything else ("Year 9", "Grade 8") is shown as typed. */
export function formatClass(raw: string): string {
  const value = raw.trim().replace(/\s+/g, " ");
  if (/^\d{1,2}[a-z]?$/i.test(value)) return `Class ${value}`;
  return value.replace(/^class\b/i, "Class");
}

// ── Date of birth (0.2: sign-up "For me", and children added by a parent) ──────────────────────────────

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;

/** Whole years from `dobIso` to `todayIso` (both "YYYY-MM-DD"). Someone born on 29 February turns a year older on 1 March. */
export function ageOn(dobIso: string, todayIso: string): number {
  const [by, bm, bd] = dobIso.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = todayIso.split("-").map(Number) as [number, number, number];
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

/**
 * The three date-of-birth boxes (day, month 1–12, year) as "YYYY-MM-DD", or the message to show. The date must be
 * real, not in the future, and give an age within `ages` on `todayIso`.
 */
export function parseDateOfBirth(
  input: { day: string; month: string; year: string },
  todayIso: string,
  ages: { min: number; max: number },
): { ok: true; iso: string; age: number } | { ok: false; error: string } {
  const [day, month, year] = [input.day, input.month, input.year].map((v) => v.trim());
  if (!day || !month || !year) return { ok: false, error: "Enter the full date of birth." };
  if (!/^\d{1,2}$/.test(day) || !/^\d{1,2}$/.test(month) || !/^\d{4}$/.test(year)) return { ok: false, error: "Enter a real date, for example 12 March 2009." };
  const [d, m, y] = [Number(day), Number(month), Number(year)];
  const date = new Date(Date.UTC(y, m - 1, d));
  if (m < 1 || m > 12 || date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return { ok: false, error: "Enter a real date, for example 12 March 2009." };
  }
  const iso = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  if (iso > todayIso) return { ok: false, error: "The date of birth can't be in the future." };
  const age = ageOn(iso, todayIso);
  if (age < ages.min || age > ages.max) return { ok: false, error: `Check the year: the age should be between ${ages.min} and ${ages.max}.` };
  return { ok: true, iso, age };
}
