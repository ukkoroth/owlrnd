import "server-only";
import { and, asc, desc, eq, inArray, max } from "drizzle-orm";
import { formatClass } from "@/domain/identity";
import { canApplyUpdate, emptyUpdate, goalLabel, sanitizeUpdate, todayIn, type StoredUpdate, type UpdateMode } from "@/domain/tracks";
import { ai, type ChatAttachmentInput } from "./ai";
import { chatBlocked, withAiContext } from "./ai/usage";
import { db } from "./db";
import { discardFiles } from "./jobs/files";
import { attachments, exams, topics, trackMessages, tracks } from "./db/schema";
import { fileStore } from "./files";
import { enqueue } from "./jobs/queue";
import { topicStrengths } from "./progress";
import { examTopicLines } from "./results";
import type { Action, Actor } from "@/domain/permissions";
import { holderRef } from "@/domain/accounts";
import { authorizeTrack } from "./learners";
import { authorOf, checkFiles, type ChatMessage, type UploadedFile } from "./tracks";

/** A live (not draft) track, if `actor` may do `action` to its learner (domain/permissions.ts). */
export async function ownLiveTrack(actor: Actor, trackId: string, action: Action = "manageTracks") {
  const own = await authorizeTrack(actor, action, trackId);
  return own && own.track.status !== "draft" ? own : null;
}

/** Rules §3: a goal-reached track restarts (2j); any other live track takes more material. */
export const modeOf = (status: string): UpdateMode => (status === "goal_reached" ? "restart" : "add");

const emptyStored: StoredUpdate = { ...emptyUpdate, ready: false };

/** The current update chat: "extend" messages since the last applied update. */
async function loadUpdateChat(trackId: string) {
  const msgs = await db
    .select()
    .from(trackMessages)
    .where(and(eq(trackMessages.trackId, trackId), eq(trackMessages.kind, "extend")))
    .orderBy(asc(trackMessages.createdAt));
  const lastApplied = msgs.map((m) => !!m.update?.applied).lastIndexOf(true);
  const current = msgs.slice(lastApplied + 1);
  const atts = current.length
    ? await db.select().from(attachments).where(inArray(attachments.trackMessageId, current.map((m) => m.id))).orderBy(asc(attachments.createdAt))
    : [];
  const messages: ChatMessage[] = current.map((m) => ({
    id: m.id,
    author: m.author,
    text: m.text,
    attachments: atts.filter((a) => a.trackMessageId === m.id).map((a) => ({ id: a.id, label: a.label ?? a.originalName, unreadable: a.unreadable })),
  }));
  const update = [...current].reverse().find((m) => m.update)?.update ?? emptyStored;
  return { messages, update, atts };
}

export async function getUpdateChat(actor: Actor, trackId: string) {
  const own = await ownLiveTrack(actor, trackId);
  if (!own) return null;
  const strengths = (await topicStrengths(own.student.id, [trackId])).get(trackId) ?? [];
  return { ...own, mode: modeOf(own.track.status), topics: strengths, ...(await loadUpdateChat(trackId)) };
}

export type UpdateTurnResult = { ok: true; messages: ChatMessage[]; update: StoredUpdate } | { ok: false; error: string };

const fmtDay = (d: Date, tz: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: tz }).format(d);

/** One turn by the account holder in an update chat. Like the create chat: nothing is saved if the AI fails. */
export async function sendUpdateTurn(actor: Actor, trackId: string, text: string, files: UploadedFile[]): Promise<UpdateTurnResult> {
  const own = await ownLiveTrack(actor, trackId);
  if (!own) return { ok: false, error: "Track not found." };
  const { track, student, holder } = own;
  // Restarting a goal-reached track is "add topics" (§2.3); both are allowed to the same accounts today.
  const message = text.trim().slice(0, 4000);
  if (!message && !files.length) return { ok: false, error: "Write a message or attach a file." };
  const fileError = checkFiles(files);
  if (fileError) return { ok: false, error: fileError };
  if (modeOf(track.status) === "restart" && !(await ownLiveTrack(actor, trackId, "addTopics"))) return { ok: false, error: "Track not found." };
  const blocked = await chatBlocked(holder);
  if (blocked) return { ok: false, error: blocked };

  const { messages, update, atts } = await loadUpdateChat(trackId);
  const strengths = (await topicStrengths(student.id, [trackId])).get(trackId) ?? [];
  const today = todayIn(holder.timeZone);
  const mode = modeOf(track.status);
  const earlier: ChatAttachmentInput[] = atts.map((a) => ({ kind: "earlier", label: a.label ?? a.originalName, text: a.extractedText, unreadable: a.unreadable }));

  let out;
  try {
    out = await withAiContext({ purpose: "track_update", holder: holderRef(holder), studentId: student.id }, () => ai().trackUpdate({
      mode,
      audience: holder.kind === "parent" ? "parent" : "learner",
      parentName: holder.name.split(" ")[0]!,
      studentName: student.name,
      className: formatClass(student.className),
      today,
      track: {
        name: track.name ?? "",
        topics: strengths.map((t) => ({ name: t.name, strength: t.strength })),
        goal: { threshold: track.goalThreshold ?? 8, runLength: track.goalRunLength ?? 3 },
        goalProgress: track.goalProgress,
        goalReachedOn: track.goalReachedAt ? fmtDay(track.goalReachedAt, student.timeZone) : null,
      },
      update,
      // The account holder's turns: the parent's, or the learner's own.
      history: messages.map((m) => ({ author: m.author === "ai" ? ("ai" as const) : ("parent" as const), text: m.text })),
      attachments: [...earlier, ...files.map((f): ChatAttachmentInput => ({ kind: "new", label: f.name, mediaType: f.type, data: f.data }))],
      message,
    }));
  } catch (err) {
    console.error("[owlrnd ai] trackUpdate failed", err);
    return { ok: false, error: "I couldn't answer just now. Send it again?" };
  }

  const clean = sanitizeUpdate(out.update, strengths.map((t) => t.name), today);
  const stored: StoredUpdate = { ...clean, ready: out.ready && canApplyUpdate(mode, clean) };
  const keys: string[] = [];
  try {
    for (const f of files) keys.push((await fileStore().put(f.data, { contentType: f.type, prefix: "track-material" })).key);
    const sentAt = new Date();
    await db.transaction(async (tx) => {
      const [pm] = await tx.insert(trackMessages).values({ trackId, author: authorOf(actor), kind: "extend", text: message, createdAt: sentAt }).returning();
      if (files.length) {
        await tx.insert(attachments).values(
          files.map((f, i) => {
            const ex = out.extracted.find((e) => e.attachment === i + 1);
            return {
              ownerType: "track_message",
              trackMessageId: pm!.id,
              fileKey: keys[i]!,
              mediaType: f.type,
              originalName: f.name.slice(0, 200),
              label: ex?.label?.slice(0, 60) || null,
              extractedText: ex?.text ?? null,
              unreadable: ex ? !ex.readable : false,
            };
          }),
        );
      }
      await tx.insert(trackMessages).values({ trackId, author: "ai", kind: "extend", text: out.reply.trim(), update: stored, createdAt: new Date(sentAt.getTime() + 1) });
    });
  } catch (err) {
    await fileStore().delete(keys).catch(() => {}); // nothing references these files yet
    throw err;
  }
  const chat = await loadUpdateChat(trackId);
  return { ok: true, messages: chat.messages, update: chat.update };
}

/**
 * The one internal operation that changes a live track's topics and goal (like createTrack; a future connector can
 * reuse it). Restart (rules §3): earlier topics become revision, new topics and goal, progress 0, active again.
 * Add material: new topics join as normal topics; the goal and its progress stay unless the goal changes.
 */
/** `studentName` null: a self-managed learner's own track, so the confirmation speaks to them ("your"). */
export async function updateTrack(input: { trackId: string; mode: UpdateMode; update: StoredUpdate; studentName: string | null }) {
  const { trackId, mode, update: u } = input;
  if (!canApplyUpdate(mode, u)) throw new Error("updateTrack: update is incomplete");
  let writeNext = false;
  await db.transaction(async (tx) => {
    const [t] = await tx.select().from(tracks).where(eq(tracks.id, trackId));
    const [{ last } = { last: 0 }] = await tx.select({ last: max(exams.number) }).from(exams).where(eq(exams.trackId, trackId));
    const [{ pos } = { pos: -1 }] = await tx.select({ pos: max(topics.position) }).from(topics).where(eq(topics.trackId, trackId));
    const [lastParentMsg] = await tx
      .select({ id: trackMessages.id })
      .from(trackMessages)
      .where(and(eq(trackMessages.trackId, trackId), eq(trackMessages.kind, "extend"), inArray(trackMessages.author, ["parent", "learner"])))
      .orderBy(desc(trackMessages.createdAt))
      .limit(1);

    if (mode === "restart") await tx.update(topics).set({ revisionOnly: true }).where(eq(topics.trackId, trackId));
    if (u.newTopics.length) {
      await tx.insert(topics).values(u.newTopics.map((n, i) => ({ trackId, name: n.name, description: n.description, position: (pos ?? -1) + 1 + i, addedInMessageId: lastParentMsg?.id ?? null })));
    }
    const resetGoal = mode === "restart" || !!u.goal;
    const status = mode === "restart" ? ("active" as const) : t!.status;
    await tx
      .update(tracks)
      .set({
        status,
        ...(resetGoal && u.goal ? { goalThreshold: u.goal.threshold, goalRunLength: u.goal.runLength } : {}),
        ...(resetGoal ? { goalProgress: 0, goalSinceExam: last ?? 0, goalReachedAt: null } : {}),
        ...(u.testDate ? { testDate: u.testDate, testLabel: u.testLabel } : {}),
      })
      .where(eq(tracks.id, trackId));

    const goal = u.goal ?? { threshold: t!.goalThreshold ?? 8, runLength: t!.goalRunLength ?? 3 };
    const text =
      mode === "restart"
        ? `Done. ${t!.name} is active again with the new topics and the goal ${goalLabel(goal)}. The next exam will be on ${input.studentName ? `${input.studentName}'s` : "your"} dashboard in a minute or two.`
        : `Done. ${u.newTopics.length ? `${u.newTopics.map((n) => n.name).join(", ")} ${u.newTopics.length === 1 ? "is" : "are"} now part of ${t!.name}, from the next exam on.` : `The new material is saved for ${t!.name}'s next exams.`} ${u.goal ? `The goal is now ${goalLabel(goal)}, and progress starts again at 0.` : "The goal and its progress stay as they were."}`;
    const [lastMsg] = await tx.select({ at: trackMessages.createdAt }).from(trackMessages).where(eq(trackMessages.trackId, trackId)).orderBy(desc(trackMessages.createdAt)).limit(1);
    await tx.insert(trackMessages).values({
      trackId,
      author: "ai",
      kind: "extend",
      text,
      update: { ...u, applied: true },
      createdAt: new Date(Math.max(Date.now(), (lastMsg?.at.getTime() ?? 0) + 1)),
    });

    const [open] = await tx.select({ id: exams.id }).from(exams).where(and(eq(exams.trackId, trackId), inArray(exams.status, ["ready", "in_progress"])));
    writeNext = status === "active" && !open;
    if (writeNext) await tx.update(tracks).set({ nextExam: "writing" }).where(eq(tracks.id, trackId));
  });
  if (writeNext) await enqueue("write_exam", { trackId });
  // 0.3: cards for new topics (and the few revision cards after a restart); topics with cards are left as they are.
  if (u.newTopics.length || mode === "restart") await enqueue("write_flashcards", { trackId, reason: "starter" });
}

/** "Start the track again" (2j) / "Apply changes" (Add material). Only an agreed, complete update is applied. */
export async function applyTrackUpdate(actor: Actor, trackId: string) {
  const own = await ownLiveTrack(actor, trackId);
  if (!own) return { ok: false as const, error: "Track not found." };
  const mode = modeOf(own.track.status);
  if (mode === "restart" && !(await ownLiveTrack(actor, trackId, "addTopics"))) return { ok: false as const, error: "Track not found." };
  const { update } = await loadUpdateChat(trackId);
  if (!update.ready || !canApplyUpdate(mode, update)) return { ok: false as const, error: "Agree the change in the chat first." };
  await updateTrack({ trackId, mode, update, studentName: own.student.type === "self_managed" ? null : own.student.name });
  const chat = await loadUpdateChatIncludingApplied(trackId);
  return { ok: true as const, ...chat };
}

/** After applying: the chat that was just applied, with its confirmation, so it stays on screen (2j). */
async function loadUpdateChatIncludingApplied(trackId: string) {
  const msgs = await db
    .select()
    .from(trackMessages)
    .where(and(eq(trackMessages.trackId, trackId), eq(trackMessages.kind, "extend")))
    .orderBy(asc(trackMessages.createdAt));
  const appliedIdx = msgs.map((m) => !!m.update?.applied);
  const last = appliedIdx.lastIndexOf(true);
  const prev = appliedIdx.slice(0, last).lastIndexOf(true);
  const current = msgs.slice(prev + 1, last + 1);
  const atts = current.length ? await db.select().from(attachments).where(inArray(attachments.trackMessageId, current.map((m) => m.id))) : [];
  return {
    messages: current.map((m): ChatMessage => ({
      id: m.id,
      author: m.author,
      text: m.text,
      attachments: atts.filter((a) => a.trackMessageId === m.id).map((a) => ({ id: a.id, label: a.label ?? a.originalName, unreadable: a.unreadable })),
    })),
    update: msgs[last]!.update!,
  };
}

/** "Start over" in an update chat: deletes its messages (and attachment rows) since the last applied update. */
export async function discardUpdateChat(actor: Actor, trackId: string) {
  if (!(await ownLiveTrack(actor, trackId))) return;
  const msgs = await db
    .select()
    .from(trackMessages)
    .where(and(eq(trackMessages.trackId, trackId), eq(trackMessages.kind, "extend")))
    .orderBy(asc(trackMessages.createdAt));
  const lastApplied = msgs.map((m) => !!m.update?.applied).lastIndexOf(true);
  const ids = msgs.slice(lastApplied + 1).map((m) => m.id);
  if (!ids.length) return;
  const atts = await db.select().from(attachments).where(inArray(attachments.trackMessageId, ids));
  await db.transaction(async (tx) => {
    await tx.delete(trackMessages).where(inArray(trackMessages.id, ids));
    await discardFiles(atts.map((a) => a.fileKey), tx);
  });
}

/** Rules §2: Archive is for goal-reached tracks; it hides the track from the student and keeps its history. */
export async function archiveTrack(actor: Actor, trackId: string) {
  const own = await ownLiveTrack(actor, trackId);
  if (!own || own.track.status !== "goal_reached") return false;
  await db.update(tracks).set({ status: "archived" }).where(eq(tracks.id, trackId));
  return true;
}

/** 2h: every marked exam of a track, newest first, with strong and needs-work topics. */
export async function examHistory(actor: Actor, trackId: string) {
  const own = await ownLiveTrack(actor, trackId, "viewProgress");
  if (!own) return null;
  const rows = await db
    .select({ id: exams.id, number: exams.number, score: exams.score, submittedAt: exams.submittedAt })
    .from(exams)
    .where(and(eq(exams.trackId, trackId), eq(exams.status, "marked")))
    .orderBy(desc(exams.number));
  const lines = await examTopicLines(rows.map((r) => r.id));
  return {
    ...own,
    exams: rows.map((r) => ({ ...r, score: r.score ?? 0, submittedAt: r.submittedAt!, strong: lines.get(r.id)?.strong ?? [], needsWork: lines.get(r.id)?.needsWork ?? [] })),
  };
}
