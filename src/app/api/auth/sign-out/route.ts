import { NextResponse, type NextRequest } from "next/server";
import { endSession } from "@/server/auth/current";
import { fromOtherSite } from "@/server/http";

// Sign out (5a, 5c, 5b, 5d): ends the session on this device only.
export async function POST(req: NextRequest) {
  // Same-origin check: a form on another site must not sign people out.
  if (fromOtherSite(req)) return new NextResponse("Forbidden", { status: 403 });
  await endSession();
  // Relative, so it never points at the app's internal address.
  return new NextResponse(null, { status: 303, headers: { Location: "/sign-in" } });
}
