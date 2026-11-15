import "server-only";
import { lt, sql } from "drizzle-orm";
import { rules } from "@/config/rules";
import { clientIp } from "./auth/current";
import { db } from "./db";
import { rateLimitHits } from "./db/schema";

export type RateLimitName = keyof typeof rules.rateLimits;

export const RATE_LIMITED = "Too many attempts from your network. Please wait a few minutes and try again.";

/**
 * Counts one request for `name` from `ip` in the current fixed window and says whether it is allowed.
 * Without an IP (local development and tests run without a proxy) nothing is limited.
 */
export async function hit(name: RateLimitName, ip: string | null, now = new Date()): Promise<boolean> {
  if (!ip) return true;
  const { max, windowMinutes } = rules.rateLimits[name];
  const windowMs = windowMinutes * 60_000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const [row] = await db
    .insert(rateLimitHits)
    .values({ bucket: `${name}:${ip}`, windowStart, count: 1 })
    .onConflictDoUpdate({ target: [rateLimitHits.bucket, rateLimitHits.windowStart], set: { count: sql`${rateLimitHits.count} + 1` } })
    .returning({ count: rateLimitHits.count });
  // Prune now and then: windows older than a day are never needed again.
  if (Math.random() < 0.02) await db.delete(rateLimitHits).where(lt(rateLimitHits.windowStart, new Date(now.getTime() - 86_400_000)));
  return row!.count <= max;
}

/** For server actions: counts this request from the caller's IP. */
export async function allowed(name: RateLimitName) {
  return hit(name, await clientIp());
}
