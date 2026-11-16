import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, makeParent, makeStudent, parentActor } from "../../tests/db-helpers";
import { db } from "./db";
import { attachments, examQuestions, exams, jobs, questions, topics, tracks } from "./db/schema";
import { writeExamJob } from "./examWriter";
import { createTrackFromDraft, discardDraft, getDraftChat, listTracks, retryExamWriting, sendChatTurn, setTrackPaused } from "./tracks";

beforeAll(() => {
  process.env.OWLRND_FAKE_AI = "1";
  process.env.STORAGE_DIR = "./storage/test";
});
afterAll(async () => {
  await db.delete(jobs).where(eq(jobs.type, "write_exam"));
  await cleanup();
});

const png = { name: "page142.png", type: "image/png", data: Buffer.from("fake image bytes") };
const LAST = { attempt: 3, isLastAttempt: true };

async function family() {
  const parent = await makeParent({ name: "Atticus Finch" });
  const student = await makeStudent(parent.id, { name: "Scout" });
  return { parent, student };
}

async function agreedDraft(parentId: string, studentId: string) {
  const first = await sendChatTurn(parentActor(parentId), studentId, "Physics unit test on 2099-11-20. Chapter 12: Ohm's law, resistors in series and resistors in parallel.", [png]);
  expect(first.ok).toBe(true);
  const second = await sendChatTurn(parentActor(parentId), studentId, "Yes. Make the goal 9 / 10 in 3 exams in a row.", []);
  if (!second.ok) throw new Error(second.error);
  return second;
}

describe("track chat (2e/2f)", () => {
  it("stores the parent's message, the attachment with its extracted text, and the AI reply with a preview", async () => {
    const { parent, student } = await family();
    const res = await sendChatTurn(parentActor(parent.id), student.id, "Physics unit test on 2099-11-20. Chapter 12: Ohm's law, resistors in series and resistors in parallel.", [png]);
    if (!res.ok) throw new Error(res.error);
    expect(res.messages.map((m) => m.author)).toEqual(["parent", "ai"]);
    expect(res.messages[0]!.attachments).toEqual([expect.objectContaining({ label: "Page 141", unreadable: false })]);
    expect(res.preview).toMatchObject({ name: "Physics: Ohm's law", testDate: "2099-11-20", goal: { threshold: 8, runLength: 3 }, ready: false });
    const [att] = await db.select().from(attachments).where(eq(attachments.id, res.messages[0]!.attachments[0]!.id));
    expect(att!.extractedText).toContain("Study notes");

    // The conversation survives a reload.
    const again = await getDraftChat(parentActor(parent.id), student.id);
    expect(again!.messages).toHaveLength(2);
  });

  it("refuses files that aren't photos or PDFs, without calling the AI", async () => {
    const { parent, student } = await family();
    const res = await sendChatTurn(parentActor(parent.id), student.id, "hi", [{ name: "notes.docx", type: "application/msword", data: Buffer.from("x") }]);
    expect(res).toEqual({ ok: false, error: "notes.docx isn't a photo or a PDF." });
    expect((await getDraftChat(parentActor(parent.id), student.id))!.draft).toBeNull();
  });

  it("saves nothing when the AI fails, so the parent can send again", async () => {
    const { parent, student } = await family();
    const spy = vi.spyOn(await import("./ai/fake"), "fakeTrackChat").mockRejectedValueOnce(new Error("overloaded"));
    const res = await sendChatTurn(parentActor(parent.id), student.id, "Physics chapter 1: motion", []);
    expect(res).toEqual({ ok: false, error: "I couldn't answer just now. Send it again?" });
    expect((await getDraftChat(parentActor(parent.id), student.id))!.messages).toHaveLength(0);
    spy.mockRestore();
  });

  it("Start over deletes the draft and its attachments", async () => {
    const { parent, student } = await family();
    const res = await sendChatTurn(parentActor(parent.id), student.id, "Physics chapter 1: motion", [png]);
    if (!res.ok) throw new Error(res.error);
    await discardDraft(parentActor(parent.id), student.id);
    expect((await getDraftChat(parentActor(parent.id), student.id))!.draft).toBeNull();
    expect(await db.select().from(attachments).where(eq(attachments.id, res.messages[0]!.attachments[0]!.id))).toHaveLength(0);
  });
});

describe("creating a track", () => {
  it("only goes live once the preview is agreed, then writes the first exam in the background", async () => {
    const { parent, student } = await family();
    await sendChatTurn(parentActor(parent.id), student.id, "Physics chapter 12: Ohm's law, resistors in series and resistors in parallel.", []);
    expect(await createTrackFromDraft(parentActor(parent.id), student.id)).toEqual({ ok: false, error: "Agree the name, topics and goal in the chat first." });

    const agreed = await agreedDraft(parent.id, (await makeStudent(parent.id)).id);
    expect(agreed.preview.ready).toBe(true);
  });

  it("activates the draft with its topics and goal, and the job writes a valid first exam", async () => {
    const { parent, student } = await family();
    await agreedDraft(parent.id, student.id);
    const res = await createTrackFromDraft(parentActor(parent.id), student.id);
    if (!res.ok) throw new Error(res.error);

    const [t] = await db.select().from(tracks).where(eq(tracks.id, res.trackId));
    expect(t).toMatchObject({ status: "active", name: "Physics: Ohm's law", goalThreshold: 9, goalRunLength: 3, goalProgress: 0, nextExam: "writing", testDate: "2099-11-20" });
    const tps = await db.select().from(topics).where(eq(topics.trackId, res.trackId));
    expect(tps.map((x) => x.name)).toEqual(["Ohm's law", "Resistors in series", "Resistors in parallel"]);
    const queued = await db.select().from(jobs).where(eq(jobs.type, "write_exam"));
    expect(queued.some((j) => (j.payload as { trackId: string }).trackId === res.trackId)).toBe(true);

    await writeExamJob({ trackId: res.trackId }, { attempt: 1, isLastAttempt: false });
    const [exam] = await db.select().from(exams).where(eq(exams.trackId, res.trackId));
    expect(exam).toMatchObject({ number: 1, status: "ready", studentId: student.id });
    const eqs = await db.select().from(examQuestions).where(eq(examQuestions.examId, exam!.id));
    expect(eqs).toHaveLength(10);
    const qs = await db.select().from(questions).where(eq(questions.trackId, res.trackId));
    expect(qs.filter((q) => q.type === "multiple_choice").length).toBeGreaterThanOrEqual(5);
    expect((await db.select().from(tracks).where(eq(tracks.id, res.trackId)))[0]!.nextExam).toBe("ready");

    const list = await listTracks(parentActor(parent.id), student.id);
    expect(list).toEqual([expect.objectContaining({ id: res.trackId, examReady: true, examsTaken: 0, topicNames: tps.map((x) => x.name) })]);
  });

  it("marks the exam as failed after the last attempt, and Try again re-queues it", async () => {
    const { parent, student } = await family();
    await agreedDraft(parent.id, student.id);
    const res = await createTrackFromDraft(parentActor(parent.id), student.id);
    if (!res.ok) throw new Error(res.error);
    vi.spyOn(await import("./ai/fake"), "fakeWriteQuestions").mockRejectedValue(new Error("model down"));
    await expect(writeExamJob({ trackId: res.trackId }, { attempt: 1, isLastAttempt: false })).rejects.toThrow();
    expect((await db.select().from(tracks).where(eq(tracks.id, res.trackId)))[0]!.nextExam).toBe("writing");
    await expect(writeExamJob({ trackId: res.trackId }, LAST)).rejects.toThrow();
    expect((await db.select().from(tracks).where(eq(tracks.id, res.trackId)))[0]!.nextExam).toBe("failed");
    vi.restoreAllMocks();

    expect(await retryExamWriting(parentActor(parent.id), res.trackId)).not.toBeNull();
    expect((await db.select().from(tracks).where(eq(tracks.id, res.trackId)))[0]!.nextExam).toBe("writing");
  });

  it("pauses and resumes, and other parents can't touch the track", async () => {
    const { parent, student } = await family();
    const other = await makeParent();
    await agreedDraft(parent.id, student.id);
    const res = await createTrackFromDraft(parentActor(parent.id), student.id);
    if (!res.ok) throw new Error(res.error);

    expect(await setTrackPaused(parentActor(other.id), res.trackId, true)).toBeNull();
    expect(await listTracks(parentActor(other.id), student.id)).toBeNull();
    expect(await sendChatTurn(parentActor(other.id), student.id, "hi", [])).toEqual({ ok: false, error: "Student not found." });

    expect(await setTrackPaused(parentActor(parent.id), res.trackId, true)).not.toBeNull();
    expect((await db.select().from(tracks).where(eq(tracks.id, res.trackId)))[0]!.status).toBe("paused");
    expect(await setTrackPaused(parentActor(parent.id), res.trackId, true)).toBeNull(); // already paused
    expect(await setTrackPaused(parentActor(parent.id), res.trackId, false)).not.toBeNull();
    expect((await db.select().from(tracks).where(eq(tracks.id, res.trackId)))[0]!.status).toBe("active");
  });
});
