import { NextResponse, type NextRequest } from "next/server";
import { endSession } from "@/server/auth/current";

/**
 * The site's public origin. Behind Caddy the app itself sees http on an internal address, so use the
 * X-Forwarded-Proto / X-Forwarded-Host that Caddy sets (the app only listens on 127.0.0.1, so visitors can't
 * set these themselves); without a proxy, the request's own origin.
 */
function publicOrigin(req: NextRequest) {
  const first = (v: string | null) => v?.split(",")[0]?.trim() || null;
  const proto = first(req.headers.get("x-forwarded-proto")) ?? req.nextUrl.protocol.replace(/:$/, "");
  const host = first(req.headers.get("x-forwarded-host")) ?? req.headers.get("host") ?? req.nextUrl.host;
  return `${proto}://${host}`;
}

// Sign out (5a, 5c, 5b, 5d): ends the session on this device only.
export async function POST(req: NextRequest) {
  // Same-origin check: a form on another site must not sign people out.
  const origin = req.headers.get("origin");
  if (origin && origin !== publicOrigin(req)) return new NextResponse("Forbidden", { status: 403 });
  await endSession();
  // Relative, so it never points at the app's internal address.
  return new NextResponse(null, { status: 303, headers: { Location: "/sign-in" } });
}
