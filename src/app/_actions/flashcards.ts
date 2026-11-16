"use server";

import { requirePractice } from "@/server/auth/current";
import * as fc from "@/server/flashcards";

// 0.3 Flashcards, F2: answering cards in a session, and finishing it. Practice only (editions §2.3, M10).

export async function answerCard(sessionId: string, cardId: string, result: "got_it" | "not_yet"): Promise<boolean> {
  const { actor } = await requirePractice();
  return fc.reviewCard(actor, sessionId, cardId, result === "got_it" ? "got_it" : "not_yet");
}

export async function finishPractice(sessionId: string): Promise<fc.SessionSummary | null> {
  const { actor } = await requirePractice();
  return fc.finishSession(actor, sessionId);
}
