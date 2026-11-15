import "server-only";
import { hash, verify } from "@node-rs/argon2";

// @node-rs/argon2 defaults to argon2id with OWASP-recommended cost settings.
export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/** Spend the same time as a real check when the account doesn't exist, so timing doesn't reveal usernames. */
export async function verifyDummyPassword(password: string): Promise<false> {
  dummyHash ??= hash("owlrnd-dummy-password");
  await verifyPassword(await dummyHash, password);
  return false;
}
