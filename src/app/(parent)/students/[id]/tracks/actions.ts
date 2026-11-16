"use server";

import { revalidatePath } from "next/cache";
import { requireShell } from "@/server/auth/current";
import { normalizeUpload } from "@/server/files/normalize";
import * as tracks from "@/server/tracks";
import type { ChatMessage, TurnResult } from "@/server/tracks";
import type { StoredPreview } from "@/domain/tracks";

/** One parent turn in the track chat (2e/2f). Files arrive as form data, already resized in the browser. */
export async function sendTurn(studentId: string, form: FormData): Promise<TurnResult> {
  const { actor } = await requireShell("parent");
  const text = typeof form.get("message") === "string" ? (form.get("message") as string) : "";
  const files = await Promise.all(
    form
      .getAll("files")
      .filter((f): f is File => f instanceof File && f.size > 0)
      // HEIC photos (which the browser can't resize) and oversized photos become JPEG here.
      .map(async (f) => normalizeUpload({ name: f.name, type: f.type, data: Buffer.from(await f.arrayBuffer()) })),
  );
  return tracks.sendChatTurn(actor, studentId, text, files);
}

export type CreateResult = { ok: true; trackId: string; messages: ChatMessage[]; preview: StoredPreview } | { ok: false; error: string };

/** "Create track" (2f). */
export async function createTrack(studentId: string): Promise<CreateResult> {
  const { actor } = await requireShell("parent");
  const res = await tracks.createTrackFromDraft(actor, studentId);
  if (!res.ok) return res;
  const chat = await tracks.getTrackChat(actor, studentId, res.trackId);
  // No revalidatePath here: it would re-render this chat page, which would then no longer count the new track as
  // a draft ("first track" → "new track"). The tracks pages are dynamic and render fresh on the next visit.
  return { ok: true, trackId: res.trackId, messages: chat!.messages, preview: chat!.preview };
}

export async function startOver(studentId: string): Promise<void> {
  const { actor } = await requireShell("parent");
  await tracks.discardDraft(actor, studentId);
}

export async function pauseTrack(trackId: string, studentId: string): Promise<void> {
  const { actor } = await requireShell("parent");
  await tracks.setTrackPaused(actor, trackId, true);
  revalidatePath(`/students/${studentId}/tracks`);
}

export async function resumeTrack(trackId: string, studentId: string): Promise<void> {
  const { actor } = await requireShell("parent");
  await tracks.setTrackPaused(actor, trackId, false);
  revalidatePath(`/students/${studentId}/tracks`);
}

export async function retryExam(trackId: string, studentId: string): Promise<void> {
  const { actor } = await requireShell("parent");
  await tracks.retryExamWriting(actor, trackId);
  revalidatePath(`/students/${studentId}/tracks`);
}
