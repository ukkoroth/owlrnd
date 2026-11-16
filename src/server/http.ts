import "server-only";
import type { NextRequest } from "next/server";

/**
 * The site's public origin. Behind Caddy the app itself sees http on an internal address, so use the
 * X-Forwarded-Proto / X-Forwarded-Host that Caddy sets (the app only listens on 127.0.0.1, so visitors can't
 * set these themselves); without a proxy, the request's own origin.
 */
export function publicOrigin(req: NextRequest) {
  const first = (v: string | null) => v?.split(",")[0]?.trim() || null;
  const proto = first(req.headers.get("x-forwarded-proto")) ?? req.nextUrl.protocol.replace(/:$/, "");
  const host = first(req.headers.get("x-forwarded-host")) ?? req.headers.get("host") ?? req.nextUrl.host;
  return `${proto}://${host}`;
}

/** Same-origin check for POST routes: a page on another site must not act for a signed-in visitor. */
export function fromOtherSite(req: NextRequest) {
  const origin = req.headers.get("origin");
  return !!origin && origin !== publicOrigin(req);
}
