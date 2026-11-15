"use server";

import { revalidatePath } from "next/cache";
import { requireParent } from "@/server/auth/current";
import { normalizeUpload } from "@/server/files/normalize";
import type { StoredUpdate } from "@/domain/tracks";
import type { ChatMessage } from "@/server/tracks";
import * as updates from "@/server/trackUpdates";

export async function sendUpdate(trackId: string, form: FormData): Promise<updates.UpdateTurnResult> {
  const { parent } = await requireParent();
  const text = typeof form.get("message") === "string" ? (form.get("message") as string) : "";
  const files = await Promise.all(
    form
      .getAll("files")
      .filter((f): f is File => f instanceof File && f.size > 0)
      // HEIC photos (which the browser can't resize) and oversized photos become JPEG here.
      .map(async (f) => normalizeUpload({ name: f.name, type: f.type, data: Buffer.from(await f.arrayBuffer()) })),
  );
  return updates.sendUpdateTurn(parent.id, trackId, text, files);
}

export type ApplyResult = { ok: true; messages: ChatMessage[]; update: StoredUpdate } | { ok: false; error: string };

/** "Start the track again" (2j) / "Apply changes" (Add material). */
export async function applyUpdate(trackId: string): Promise<ApplyResult> {
  const { parent } = await requireParent();
  return updates.applyTrackUpdate(parent.id, trackId);
}

export async function startOverUpdate(trackId: string): Promise<void> {
  const { parent } = await requireParent();
  await updates.discardUpdateChat(parent.id, trackId);
}

export async function archive(trackId: string, studentId: string): Promise<void> {
  const { parent } = await requireParent();
  await updates.archiveTrack(parent.id, trackId);
  revalidatePath(`/students/${studentId}/tracks`);
}
