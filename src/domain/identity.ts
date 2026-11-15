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
