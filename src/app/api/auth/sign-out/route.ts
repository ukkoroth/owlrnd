import { NextResponse, type NextRequest } from "next/server";
import { endSession } from "@/server/auth/current";

// Sign out (5a, 5c, 5b, 5d): ends the session on this device only.
export async function POST(req: NextRequest) {
  // Same-origin check: a form on another site must not sign people out.
  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin) return new NextResponse("Forbidden", { status: 403 });
  await endSession();
  return NextResponse.redirect(new URL("/sign-in", req.url), 303);
}
