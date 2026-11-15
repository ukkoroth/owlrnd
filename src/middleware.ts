import { NextResponse, type NextRequest } from "next/server";

// Keeps the session cookie's 30-day window sliding on the browser side; the database decides if the session is valid.
const SESSION_COOKIE = "owlrnd_session";
const MAX_AGE = 30 * 24 * 60 * 60; // rules.accounts.sessionIdleDays (middleware runs on the edge and can't import server code)

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
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
