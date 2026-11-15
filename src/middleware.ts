import { NextResponse, type NextRequest } from "next/server";

// Keeps the session cookie's 30-day window sliding on the browser side; the database decides if the session is valid.
const SESSION_COOKIE = "owlrnd_session";
const MAX_AGE = 30 * 24 * 60 * 60; // rules.accounts.sessionIdleDays (middleware runs on the edge and can't import server code)

/**
 * Content-Security-Policy with a fresh nonce per request (release plan, Phase 1 item 5): only this site's own
 * scripts carrying the nonce run, nothing can frame the site, and forms post only to it. Next.js reads the nonce
 * from the request's CSP header and adds it to its own scripts. Styles allow inline because React style props
 * (bar heights, chart cells) are inline.
 */
function contentSecurityPolicy(nonce: string) {
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws:" : ""}`,
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
}

export function middleware(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  // Server actions (POST) may sign in, out or delete the account; never re-send the old cookie on those.
  if (req.method !== "GET") return res;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: MAX_AGE,
    });
  }
  return res;
}

export const config = {
  // Pages only: skip static files, images and the sign-out route (which deletes the cookie).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth/sign-out).*)"],
};
