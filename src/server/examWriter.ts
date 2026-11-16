import "server-only";
import { holderRef } from "@/domain/accounts";
import { loadLearner } from "./learners";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { firstExamPlan, type PlanSlot } from "@/domain/examPlan";
import { planWithRevision } from "@/domain/examMix";
import { formatClass } from "@/domain/identity";
import { rules } from "@/config/rules";
import { ai } from "./ai";
import { enqueue } from "./jobs/queue";
import { examWriteBlocked, withAiContext } from "./ai/usage";
import { db } from "./db";
import { attachments, examQuestions, exams, marks, questions, topics, trackMessages, tracks } from "./db/schema";
import type { JobContext } from "./jobs/worker";
import { topicStrengths } from "./progress";

const RETRIES_PER_EXAM = 2;
const AVOID_LAST_EXAMS = 3; // rules §4: no identical question within 3 exams

/** The parent's messages and the text read from their attachments: the material questions are written from. */
export async function trackMaterial(trackId: string): Promise<string> {
  const msgs = await db.select().from(trackMessages).where(eq(trackMessages.trackId, trackId)).orderBy(asc(trackMessages.createdAt));
  // Update chats count once applied; an abandoned update chat's material is left out.
  const lastApplied = [...msgs].reverse().find((m) => m.kind === "extend" && m.update?.applied)?.createdAt;
  const parentMsgs = msgs.filter((m) => m.author === "parent" && (m.kind === "create" || (lastApplied && m.createdAt <= lastApplied)));
  const atts = parentMsgs.length
    ? await db
        .select()
        .from(attachments)
        .where(inArray(attachments.trackMessageId, parentMsgs.map((m) => m.id)))
        .orderBy(asc(attachments.createdAt))
    : [];
  const parts = parentMsgs.filter((m) => m.text).map((m) => `Parent: ${m.text}`);
  for (const a of atts) if (!a.unreadable && a.extractedText) parts.push(`[${a.label ?? a.originalName}]\n${a.extractedText}`);
  return parts.join("\n\n");
}

/**
 * The plan for the track's next exam (rules §4). The first exam covers every topic about evenly; later exams use
 * the 50 / 30 / 20 mix from the student's topic strength, with up to 2 reworded retries of recent misses on
 * needs-work topics. Also returns the prompts of the last 3 exams, which must not be repeated.
 */
export async function planNextExam(trackId: string, studentId: string, keyed: { key: string; id: string; name: string; revisionOnly?: boolean }[]) {
  const recentExams = await db
    .select({ id: exams.id, status: exams.status })
    .from(exams)
    .where(eq(exams.trackId, trackId))
    .orderBy(desc(exams.number))
    .limit(AVOID_LAST_EXAMS);
  const avoid = recentExams.length
    ? (
        await db
          .select({ prompt: questions.prompt })
          .from(examQuestions)
          .innerJoin(questions, eq(questions.id, examQuestions.questionId))
          .where(inArray(examQuestions.examId, recentExams.map((e) => e.id)))
      ).map((r) => r.prompt)
    : [];

  const marked = recentExams.filter((e) => e.status === "marked");
  if (!marked.length) return { plan: firstExamPlan(keyed.map((t) => t.key)) as PlanSlot[], avoid };

  const strengths = (await topicStrengths(studentId, [trackId])).get(trackId) ?? [];
  const mixTopics = keyed.map((t) => ({ key: t.key, name: t.name, strength: strengths.find((s) => s.id === t.id)?.strength ?? "not_tested", revision: !!t.revisionOnly }));
  // Earlier topics kept as revision get about 2 questions; the rest follow the usual mix (rules §3, §4).
  const plan: PlanSlot[] = planWithRevision(
    mixTopics.filter((t) => !t.revision),
    mixTopics.filter((t) => t.revision),
  );

  // Reworded retries of questions missed in the last marked exam, on topics that still need work.
  const missed = await db
    .select({ prompt: questions.prompt, topicId: questions.topicId, type: questions.type })
    .from(marks)
    .innerJoin(questions, eq(questions.id, marks.questionId))
    .where(and(eq(marks.examId, marked[0]!.id), eq(marks.verdict, "missed")));
  let retries = 0;
  for (const m of missed) {
    if (retries >= RETRIES_PER_EXAM) break;
    const key = keyed.find((t) => t.id === m.topicId)?.key;
    const topic = mixTopics.find((t) => t.key === key);
    if (!key || topic?.strength !== "needs_work" || topic.revision) continue;
    const slot = plan.find((s) => s.topicKey === key && s.type === m.type && !s.retryOf);
    if (slot) {
      slot.retryOf = m.prompt;
      retries++;
    }
  }
  return { plan, avoid };
}

/** Job "write_exam": writes the track's next exam and stores it as a fixed paper (status "ready"). */
export async function writeExamJob(payload: unknown, ctx: JobContext) {
  const { trackId } = payload as { trackId: string };
  try {
    const [track] = await db.select().from(tracks).where(eq(tracks.id, trackId));
    if (!track || track.status === "draft") return; // deleted or never created: nothing to do
    // Never two open exams in a track (a resume and a marking can both ask for the next exam).
    const [open] = await db
      .select({ id: exams.id })
      .from(exams)
      .where(and(eq(exams.trackId, trackId), inArray(exams.status, ["ready", "in_progress"])));
    if (open) {
      await db.update(tracks).set({ nextExam: "ready" }).where(eq(tracks.id, trackId));
      return;
    }
    const learner = await loadLearner(track.studentId);
    if (!learner) return;
    const { student, holder } = learner;
    // AI cost controls: over the holder's daily limit or allowance, or the monthly budget, try again later.
    const blocked = await examWriteBlocked(holder);
    if (blocked) {
      await enqueue("write_exam", { trackId }, { runAt: blocked.retryAt });
      console.info(`[owlrnd ai] exam for track ${trackId} postponed (${blocked.reason}) until ${blocked.retryAt.toISOString()}`);
      return;
    }
    const tps = await db.select().from(topics).where(eq(topics.trackId, trackId)).orderBy(asc(topics.position));
    const keyed = tps.map((t, i) => ({ key: `T${i + 1}`, id: t.id, name: t.name, description: t.description, revisionOnly: t.revisionOnly }));
    const { plan, avoid } = await planNextExam(trackId, track.studentId, keyed);

    const material = await trackMaterial(trackId);
    const written = await withAiContext({ purpose: "write_exam", holder: holderRef(holder), studentId: student.id }, () => ai().writeQuestions({
      trackName: track.name ?? "",
      className: formatClass(student.className),
      topics: keyed,
      focusNotes: track.focusNotes,
      material,
      plan,
      avoid,
    }));

    await db.transaction(async (tx) => {
      const [{ n } = { n: 0 }] = await tx.select({ n: count() }).from(exams).where(eq(exams.trackId, trackId));
      const inserted = await tx
        .insert(questions)
        .values(
          written.map((q) => ({
            trackId,
            topicId: keyed.find((t) => t.key === q.topicKey)!.id,
            type: q.type,
            prompt: q.prompt.trim(),
            options: q.type === "multiple_choice" ? q.options.map((o) => o.trim()) : [],
            correctOption: q.type === "multiple_choice" ? q.correctIndex : null,
            expectedAnswer: q.type === "short" ? q.expectedAnswer!.trim() : null,
            marks: q.type === "multiple_choice" ? rules.marks.multipleChoice : rules.marks.short,
            difficulty: q.difficulty,
            explanation: q.explanation.trim(),
          })),
        )
        .returning({ id: questions.id });
      const [exam] = await tx.insert(exams).values({ studentId: track.studentId, trackId, number: n + 1, status: "ready" }).returning();
      await tx.insert(examQuestions).values(inserted.map((q, i) => ({ examId: exam!.id, questionId: q.id, position: i + 1 })));
      await tx.update(tracks).set({ nextExam: "ready" }).where(eq(tracks.id, trackId));
    });
  } catch (err) {
    if (ctx.isLastAttempt) await db.update(tracks).set({ nextExam: "failed" }).where(eq(tracks.id, trackId));
    throw err;
  }
}
