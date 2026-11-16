import "server-only";
import { and, asc, count, desc, eq, inArray, ne } from "drizzle-orm";
import { rules } from "@/config/rules";
import { formatClass } from "@/domain/identity";
import { pickTrackColor } from "@/domain/trackColors";
import { canCreateTrack, emptyPreview, goalLabel, sanitizePreview, todayIn, type StoredPreview } from "@/domain/tracks";
import { ai, type ChatAttachmentInput } from "./ai";
import { chatBlocked, withAiContext } from "./ai/usage";
import { db } from "./db";
import { discardFiles } from "./jobs/files";
import { attachments, exams, topics, trackMessages, tracks } from "./db/schema";
import { fileStore } from "./files";
import { enqueue } from "./jobs/queue";
import { topicStrengths, type TopicWithStrength } from "./progress";
import { recentScores } from "./results";
import type { Actor } from "@/domain/permissions";
import { holderRef } from "@/domain/accounts";
import { authorizeLearner, authorizeTrack } from "./learners";

export type Track = typeof tracks.$inferSelect;
export type ChatMessage = {
  id: string;
  /** "parent" or "learner": whoever controls the track wrote it. */
  author: "parent" | "learner" | "ai";
  text: string;
  attachments: { id: string; label: string; unreadable: boolean }[];
};

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // Claude's per-image limit; the browser resizes well below this

// ── Draft (the chat in progress) ───────────────────────────────────────────

async function findDraft(studentId: string) {
  const [draft] = await db
    .select()
    .from(tracks)
    .where(and(eq(tracks.studentId, studentId), eq(tracks.status, "draft")))
    .orderBy(desc(tracks.createdAt))
    .limit(1);
  return draft ?? null;
}

/** The student's draft chat: messages with their attachments, and the latest preview. Null if none started. */
export async function getDraftChat(actor: Actor, studentId: string) {
  if (!(await authorizeLearner(actor, "manageTracks", studentId))) return null;
  const draft = await findDraft(studentId);
  if (!draft) return { draft: null, messages: [] as ChatMessage[], preview: { ...emptyPreview, ready: false } as StoredPreview };
  return { draft, ...(await loadChat(draft.id)) };
}

async function loadChat(trackId: string) {
  const msgs = await db
    .select()
    .from(trackMessages)
    .where(and(eq(trackMessages.trackId, trackId), eq(trackMessages.kind, "create")))
    .orderBy(asc(trackMessages.createdAt));
  const atts = msgs.length
    ? await db
        .select()
        .from(attachments)
        .where(inArray(attachments.trackMessageId, msgs.map((m) => m.id)))
        .orderBy(asc(attachments.createdAt))
    : [];
  const messages: ChatMessage[] = msgs.map((m) => ({
    id: m.id,
    author: m.author,
    text: m.text,
    attachments: atts.filter((a) => a.trackMessageId === m.id).map((a) => ({ id: a.id, label: a.label ?? a.originalName, unreadable: a.unreadable })),
  }));
  const lastPreview = [...msgs].reverse().find((m) => m.preview)?.preview;
  return { messages, preview: lastPreview ?? ({ ...emptyPreview, ready: false } as StoredPreview), rows: { msgs, atts } };
}

export type UploadedFile = { name: string; type: string; data: Buffer };

export function checkFiles(files: UploadedFile[]): string | null {
  if (files.length > rules.chat.maxFilesPerMessage) return `Attach at most ${rules.chat.maxFilesPerMessage} files at a time.`;
  for (const f of files) {
    if (f.type === "application/pdf") {
      if (f.data.length > rules.chat.maxPdfBytes) return `${f.name} is too large. PDFs can be up to 15 MB.`;
    } else if ((IMAGE_TYPES as readonly string[]).includes(f.type)) {
      if (f.data.length > MAX_IMAGE_BYTES) return `${f.name} is too large. Photos can be up to 5 MB.`;
    } else return `${f.name} isn't a photo or a PDF.`;
  }
  return null;
}

export type TurnResult = { ok: true; messages: ChatMessage[]; preview: StoredPreview } | { ok: false; error: string };

/**
 * One turn by the account holder in the track chat (2e/2f): store the files, ask the AI, then save both messages
 * together. If the AI fails nothing is saved, so they can simply send again.
 */
export async function sendChatTurn(actor: Actor, studentId: string, text: string, files: UploadedFile[]): Promise<TurnResult> {
  const own = await authorizeLearner(actor, "manageTracks", studentId);
  if (!own) return { ok: false, error: "Student not found." };
  const { student, holder } = own;
  const message = text.trim().slice(0, 4000);
  if (!message && !files.length) return { ok: false, error: "Write a message or attach a file." };
  const fileError = checkFiles(files);
  if (fileError) return { ok: false, error: fileError };
  const blocked = await chatBlocked(holder);
  if (blocked) return { ok: false, error: blocked };

  let draft: Track | null = await findDraft(studentId);
  const { messages, preview, rows } = draft ? await loadChat(draft.id) : { messages: [], preview: { ...emptyPreview, ready: false } as StoredPreview, rows: { msgs: [], atts: [] } };
  const [{ n: liveTracks } = { n: 0 }] = await db
    .select({ n: count() })
    .from(tracks)
    .where(and(eq(tracks.studentId, studentId), ne(tracks.status, "draft")));

  const earlier: ChatAttachmentInput[] = rows.atts.map((a) => ({ kind: "earlier", label: a.label ?? a.originalName, text: a.extractedText, unreadable: a.unreadable }));
  const fresh: ChatAttachmentInput[] = files.map((f) => ({ kind: "new", label: f.name, mediaType: f.type, data: f.data }));
  const today = todayIn(holder.timeZone);

  let out;
  try {
    out = await withAiContext({ purpose: "track_chat", holder: holderRef(holder), studentId }, () => ai().trackChat({
      audience: holder.kind === "parent" ? "parent" : "learner",
      parentName: holder.name.split(" ")[0]!,
      studentName: student.name,
      className: formatClass(student.className),
      today,
      mode: liveTracks === 0 ? "first" : "new",
      preview: { ...preview },
      // The account holder's turns: the parent's, or the learner's own.
      history: messages.map((m) => ({ author: m.author === "ai" ? ("ai" as const) : ("parent" as const), text: m.text })),
      attachments: [...earlier, ...fresh],
      message,
    }));
  } catch (err) {
    console.error("[owlrnd ai] trackChat failed", err);
    return { ok: false, error: "I couldn't answer just now. Send it again?" };
  }

  const clean = sanitizePreview(out.preview, today);
  const stored: StoredPreview = { ...clean, ready: out.ready && canCreateTrack(clean) };

  // Files are written only after the AI answered, then everything is saved in one transaction.
  const keys: string[] = [];
  try {
    for (const f of files) keys.push((await fileStore().put(f.data, { contentType: f.type, prefix: "track-material" })).key);
    // Both timestamps come from one clock (app and database clocks can differ by a few ms), so the AI's reply
    // always sorts after the parent's message.
    const sentAt = new Date();
    await db.transaction(async (tx) => {
      if (!draft) {
        // A colour of its own: the one the learner's other tracks use least (owner, 2026-11-16).
        const used = await tx.select({ c: tracks.colorIndex }).from(tracks).where(and(eq(tracks.studentId, studentId), ne(tracks.status, "archived")));
        draft = (await tx.insert(tracks).values({ studentId, colorIndex: pickTrackColor(used.map((u) => u.c)) }).returning())[0]!;
      }
      const [pm] = await tx.insert(trackMessages).values({ trackId: draft!.id, author: authorOf(actor), text: message, createdAt: sentAt }).returning();
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
      await tx.insert(trackMessages).values({ trackId: draft!.id, author: "ai", text: out.reply.trim(), preview: stored, createdAt: new Date(sentAt.getTime() + 1) });
    });
  } catch (err) {
    await fileStore().delete(keys).catch(() => {}); // nothing references these files yet
    throw err;
  }

  const chat = await loadChat(draft!.id);
  return { ok: true, messages: chat.messages, preview: chat.preview };
}

/** Who a chat message is from: the parent, or a self-managed learner setting up their own track. */
export const authorOf = (actor: Actor) => (actor.kind === "parent" ? ("parent" as const) : ("learner" as const));

/** "Start over": deletes the draft, its messages, attachments and files. */
export async function discardDraft(actor: Actor, studentId: string) {
  if (!(await authorizeLearner(actor, "manageTracks", studentId))) return;
  const draft = await findDraft(studentId);
  if (!draft) return;
  const { rows } = await loadChat(draft.id);
  await db.transaction(async (tx) => {
    await tx.delete(tracks).where(eq(tracks.id, draft.id)); // messages and attachment rows cascade
    await discardFiles(rows.atts.map((a) => a.fileKey), tx);
  });
}

// ── Making a track live ────────────────────────────────────────────────────

/**
 * The one internal operation that makes a track live (PLAN.md: a future Claude connector reuses it).
 * Writes the agreed fields and topics, activates the track and starts writing its first exam.
 */
/** `studentName` null: a self-managed learner's own track, so the confirmation speaks to them ("your"). */
export async function createTrack(input: { trackId: string; studentName: string | null; isFirst: boolean; preview: StoredPreview }) {
  const p = input.preview;
  if (!canCreateTrack(p)) throw new Error("createTrack: preview is incomplete");
  await db.transaction(async (tx) => {
    await tx
      .update(tracks)
      .set({
        name: p.name!.trim(),
        status: "active",
        testDate: p.testDate,
        testLabel: p.testLabel,
        goalThreshold: p.goal!.threshold,
        goalRunLength: p.goal!.runLength,
        goalProgress: 0,
        focusNotes: p.focusNotes,
        nextExam: "writing",
        activatedAt: new Date(),
      })
      .where(eq(tracks.id, input.trackId));
    await tx.insert(topics).values(p.topics.map((t, i) => ({ trackId: input.trackId, name: t.name, description: t.description, position: i })));
    const [last] = await tx
      .select({ at: trackMessages.createdAt })
      .from(trackMessages)
      .where(eq(trackMessages.trackId, input.trackId))
      .orderBy(desc(trackMessages.createdAt))
      .limit(1);
    await tx.insert(trackMessages).values({
      trackId: input.trackId,
      author: "ai",
      createdAt: new Date(Math.max(Date.now(), (last?.at.getTime() ?? 0) + 1)),
      text: (() => {
        const n = input.studentName;
        const which = input.isFirst ? (n ? `${n}'s first track` : "your first track") : n ? `a new track for ${n}` : "a new track";
        return `Done. "${p.name}" is ${which}, with the goal ${goalLabel(p.goal!)}. I'm writing the first exam now; it will be on ${n ? `${n}'s` : "your"} dashboard in a minute or two.`;
      })(),
    });
  });
  await enqueue("write_exam", { trackId: input.trackId });
  // 0.3: the starter flashcard deck, written in the background too.
  await enqueue("write_flashcards", { trackId: input.trackId, reason: "starter" });
}

/** "Create track" (2f). Any complete preview can go live: a name, topics and a goal (rules §2, owner 2026-11-16). */
export async function createTrackFromDraft(actor: Actor, studentId: string) {
  const own = await authorizeLearner(actor, "manageTracks", studentId);
  if (!own) return { ok: false as const, error: "Student not found." };
  const { student } = own;
  const draft = await findDraft(studentId);
  if (!draft) return { ok: false as const, error: "There is no track to create yet." };
  const { preview } = await loadChat(draft.id);
  if (!canCreateTrack(preview)) return { ok: false as const, error: "The track still needs a name, topics and a goal." };
  const [{ n } = { n: 0 }] = await db
    .select({ n: count() })
    .from(tracks)
    .where(and(eq(tracks.studentId, studentId), ne(tracks.status, "draft")));
  await createTrack({ trackId: draft.id, studentName: student.type === "self_managed" ? null : student.name, isFirst: n === 0, preview });
  return { ok: true as const, trackId: draft.id };
}

/** The chat of a track that was just created (2f after Create track), so the confirmation stays on screen. */
export async function getTrackChat(actor: Actor, studentId: string, trackId: string) {
  if (!(await authorizeLearner(actor, "manageTracks", studentId))) return null;
  const [t] = await db
    .select()
    .from(tracks)
    .where(and(eq(tracks.id, trackId), eq(tracks.studentId, studentId)));
  if (!t) return null;
  return { track: t, ...(await loadChat(t.id)) };
}

// ── Tracks page (2d, 2g) ───────────────────────────────────────────────────

export type TrackSummary = Track & {
  topicNames: string[];
  topics: TopicWithStrength[];
  scores: number[];
  examsTaken: number;
  examReady: boolean;
  /** The exam waiting to be taken (ready, or started and left), for the learner's "Start exam N" (sm-4.1a). */
  readyExam: { id: string; number: number; started: boolean } | null;
  /** When the learner started the track's first exam, for the card's day count; null before any exam is started. */
  firstExamAt: Date | null;
};

export async function listTracks(actor: Actor, studentId: string): Promise<TrackSummary[] | null> {
  if (!(await authorizeLearner(actor, "viewProgress", studentId))) return null;
  const rows = await db
    .select()
    .from(tracks)
    .where(and(eq(tracks.studentId, studentId), ne(tracks.status, "draft")))
    .orderBy(desc(tracks.activatedAt));
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const tps = await db.select().from(topics).where(inArray(topics.trackId, ids)).orderBy(asc(topics.position));
  const ex = await db.select({ id: exams.id, number: exams.number, trackId: exams.trackId, status: exams.status, startedAt: exams.startedAt }).from(exams).where(inArray(exams.trackId, ids));
  const strengths = await topicStrengths(studentId, ids);
  const scores = await recentScores(ids);
  return rows.map((t) => ({
    ...t,
    topicNames: tps.filter((x) => x.trackId === t.id).map((x) => x.name),
    topics: strengths.get(t.id) ?? [],
    scores: scores.get(t.id) ?? [],
    examsTaken: ex.filter((e) => e.trackId === t.id && e.status === "marked").length,
    examReady: ex.some((e) => e.trackId === t.id && e.status === "ready"),
    readyExam: (() => {
      const open = ex.find((e) => e.trackId === t.id && (e.status === "ready" || e.status === "in_progress"));
      return open ? { id: open.id, number: open.number, started: open.status === "in_progress" } : null;
    })(),
    firstExamAt: ex
      .filter((e) => e.trackId === t.id && e.startedAt)
      .reduce<Date | null>((first, e) => (!first || e.startedAt! < first ? e.startedAt! : first), null),
  }));
}

async function ownTrack(actor: Actor, trackId: string) {
  return (await authorizeTrack(actor, "manageTracks", trackId))?.track ?? null;
}

/** Rules §2: pause and resume are for whoever controls the track; paused tracks keep their history and produce no new exams. */
export async function setTrackPaused(actor: Actor, trackId: string, paused: boolean) {
  const t = await ownTrack(actor, trackId);
  if (!t || !(paused ? t.status === "active" : t.status === "paused")) return null;
  await db
    .update(tracks)
    .set({ status: paused ? "paused" : "active" })
    .where(eq(tracks.id, trackId));
  if (!paused && t.nextExam === "none") {
    // Paused before its next exam was written: write it now (write_exam skips if one is already open).
    await db.update(tracks).set({ nextExam: "writing" }).where(eq(tracks.id, trackId));
    await enqueue("write_exam", { trackId });
  }
  return t;
}

/** "Try again" when the first exam couldn't be written. */
export async function retryExamWriting(actor: Actor, trackId: string) {
  const t = await ownTrack(actor, trackId);
  if (!t || t.nextExam !== "failed") return null;
  await db.update(tracks).set({ nextExam: "writing" }).where(eq(tracks.id, trackId));
  await enqueue("write_exam", { trackId });
  return t;
}
