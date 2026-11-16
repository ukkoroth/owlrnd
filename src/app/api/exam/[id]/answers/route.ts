import { NextResponse, type NextRequest } from "next/server";
import { can } from "@/domain/permissions";
import { actorOf, getCurrentUser, getLearnerConsent } from "@/server/auth/current";
import { saveAnswer } from "@/server/exams";
import { fromOtherSite } from "@/server/http";

type Body = { answers?: Record<string, { chosenOption?: number | null; text?: string | null }> };

/**
 * Answers sent as the paper is left (0.2: the answer sheet survives the Back button). The browser sends them with
 * navigator.sendBeacon when the page is hidden or the paper unmounts, so nothing typed is lost. Same checks as
 * saving one answer: the learner's own exam, in progress, its own questions, and practice allowed (M10).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (fromOtherSite(req)) return new NextResponse("Forbidden", { status: 403 });
  const user = await getCurrentUser();
  if (!user || user.role !== "student") return new NextResponse("Unauthorized", { status: 401 });
  if (!can(actorOf(user, await getLearnerConsent()), "practise", user.student)) return new NextResponse("Forbidden", { status: 403 });

  const { id } = await params;
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }
  const entries = Object.entries(body.answers ?? {}).slice(0, 50);
  let saved = 0;
  for (const [questionId, v] of entries) {
    const value = { chosenOption: typeof v?.chosenOption === "number" ? v.chosenOption : null, text: typeof v?.text === "string" ? v.text : null };
    if (await saveAnswer(user.student.id, id, questionId, value)) saved++;
  }
  return NextResponse.json({ saved }, { status: saved === entries.length ? 200 : 207 });
}
