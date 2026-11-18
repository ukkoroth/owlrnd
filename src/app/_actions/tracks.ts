"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { StoredPreview, StoredUpdate } from "@/domain/tracks";
import { requireActor } from "@/server/auth/current";
import { normalizeUpload, type Upload } from "@/server/files/normalize";
import * as tracks from "@/server/tracks";
import type { ChatMessage, TurnResult } from "@/server/tracks";
import * as updates from "@/server/trackUpdates";

// Track actions for both shells (0.2 plan, M9): a parent managing a child's tracks and a self-managed learner
// managing their own. Which of them may do what is decided by the server functions through the permission policy
// (domain/permissions.ts); a parent-managed learner is refused there.

/** Files arrive as form data, already resized in the browser. HEIC photos and oversized photos become JPEG here. */
async function filesFrom(form: FormData): Promise<Upload[]> {
  return Promise.all(
    form
      .getAll("files")
      .filter((f): f is File => f instanceof File && f.size > 0)
      .map(async (f) => normalizeUpload({ name: f.name, type: f.type, data: Buffer.from(await f.arrayBuffer()) })),
  );
}

const messageFrom = (form: FormData) => (typeof form.get("message") === "string" ? (form.get("message") as string) : "");

/** Both the parent's and the learner's track pages show the change on their next visit. */
function refreshTracks(studentId: string) {
  revalidatePath(`/students/${studentId}/tracks`);
  revalidatePath("/tracks");
  revalidatePath("/today");
}

// ── Creating a track (2e/2f, sm-2d/2e) ─────────────────────────────────────

/** One turn by the account holder in the track chat. */
export async function sendTurn(studentId: string, form: FormData): Promise<TurnResult> {
  const { actor } = await requireActor();
  return tracks.sendChatTurn(actor, studentId, messageFrom(form), await filesFrom(form));
}

export type CreateResult = { ok: true; trackId: string; messages: ChatMessage[]; preview: StoredPreview } | { ok: false; error: string };

/** "Create track". */
export async function createTrack(studentId: string): Promise<CreateResult> {
  const { actor } = await requireActor();
  const res = await tracks.createTrackFromDraft(actor, studentId);
  if (!res.ok) return res;
  const chat = await tracks.getTrackChat(actor, studentId, res.trackId);
  // No revalidatePath here: it would re-render this chat page, which would then no longer count the new track as
  // a draft ("first track" → "new track"). The tracks pages are dynamic and render fresh on the next visit.
  return { ok: true, trackId: res.trackId, messages: chat!.messages, preview: chat!.preview };
}

/**
 * "Try a sample track" (owner, 2026-11-18). A learner goes to their dashboard, where the first exam is waiting;
 * a parent goes back to the child's tracks.
 */
export async function trySample(studentId: string): Promise<void> {
  const { actor } = await requireActor();
  const res = await tracks.createSampleTrack(actor, studentId);
  // Refused (not theirs to manage, or no such sample): nothing to show. Already added: go to it as usual.
  if (!res.ok && !("trackId" in res)) return;
  refreshTracks(studentId);
  redirect(actor.kind === "parent" ? `/students/${studentId}/tracks?created=1` : "/today");
}

export async function startOver(studentId: string): Promise<void> {
  const { actor } = await requireActor();
  await tracks.discardDraft(actor, studentId);
}

// ── Managing a track (2g, sm-4.1a) ─────────────────────────────────────────

export async function pauseTrack(trackId: string, studentId: string): Promise<void> {
  const { actor } = await requireActor();
  await tracks.setTrackPaused(actor, trackId, true);
  refreshTracks(studentId);
}

export async function resumeTrack(trackId: string, studentId: string): Promise<void> {
  const { actor } = await requireActor();
  await tracks.setTrackPaused(actor, trackId, false);
  refreshTracks(studentId);
}

export async function retryExam(trackId: string, studentId: string): Promise<void> {
  const { actor } = await requireActor();
  await tracks.retryExamWriting(actor, trackId);
  refreshTracks(studentId);
}

export async function archive(trackId: string, studentId: string): Promise<void> {
  const { actor } = await requireActor();
  await updates.archiveTrack(actor, trackId);
  refreshTracks(studentId);
}

export async function restore(trackId: string, studentId: string): Promise<void> {
  const { actor } = await requireActor();
  await updates.restoreTrack(actor, trackId);
  refreshTracks(studentId);
}

/** Delete for good (roadmap 22). From the track's own page, `then` is the tracks list to go back to. */
export async function remove(trackId: string, studentId: string, then: string | null): Promise<void> {
  const { actor } = await requireActor();
  const done = await updates.deleteTrack(actor, trackId);
  refreshTracks(studentId);
  if (done && then) redirect(then);
}

// ── Adding material or topics (2j, sm-2i) ──────────────────────────────────

export async function sendUpdate(trackId: string, form: FormData): Promise<updates.UpdateTurnResult> {
  const { actor } = await requireActor();
  return updates.sendUpdateTurn(actor, trackId, messageFrom(form), await filesFrom(form));
}

export type ApplyResult = { ok: true; messages: ChatMessage[]; update: StoredUpdate } | { ok: false; error: string };

/** "Start the track again" (restart) / "Apply changes" (Add material). */
export async function applyUpdate(trackId: string): Promise<ApplyResult> {
  const { actor } = await requireActor();
  return updates.applyTrackUpdate(actor, trackId);
}

export async function startOverUpdate(trackId: string): Promise<void> {
  const { actor } = await requireActor();
  await updates.discardUpdateChat(actor, trackId);
}
