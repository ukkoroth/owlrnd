import "server-only";
import type { WrittenQuestion } from "@/domain/examPlan";
import { defaultGoal, goalLabel, type TrackPreview } from "@/domain/tracks";
import type { TrackChatOutput } from "./schemas";
import type { TrackChatInput } from "./trackChat";
import type { WriteQuestionsInput } from "./writeQuestions";
import type { WriteFlashcardsInput } from "./writeFlashcards";
import type { WrittenCard } from "@/domain/flashcards";
import type { AnswerToMark, MarkedAnswer } from "./markAnswers";
import type { TrackUpdateInput } from "./trackUpdate";
import type { TrackUpdateOutput } from "./schemas";
import type { DrawVisualsInput, DrawnVisuals } from "./drawVisuals";
import { sampleVisuals } from "@/content/visuals/samples";

/**
 * Deterministic stand-in for Claude, used when OWLRND_FAKE_AI=1 (automated tests). It reads simple cues from the
 * parent's text — "Subject ... Chapter N: a, b and c", "goal X / 10 in N", "on YYYY-MM-DD" — and returns the same
 * shapes as the real calls.
 */
export async function fakeTrackChat(input: TrackChatInput): Promise<TrackChatOutput> {
  const parentTexts = [...input.history.filter((m) => m.author === "parent").map((m) => m.text), input.message];
  const all = parentTexts.join(" \n ");
  const p: TrackPreview = { ...input.preview, topics: [...input.preview.topics] };

  const subject = all.match(/\b(Physics|Maths|Chemistry|Biology|History|Geography|English)\b/i)?.[1];
  const chapter = all.match(/Chapter\s*\d*\s*:?\s*([^.\n]+)/i)?.[1]?.trim();
  if (!p.name && subject) p.name = `${subject[0]!.toUpperCase()}${subject.slice(1).toLowerCase()}: ${chapter ? titleCase(chapter.split(/,| and /)[0]!) : "Practice"}`;
  if (!p.topics.length && chapter) {
    p.topics = chapter
      .split(/,|\band\b/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((name) => ({ name: name[0]!.toUpperCase() + name.slice(1), description: `Questions on ${name}.` }));
  }
  const goal = input.message.match(/goal\s*(?:to\s*)?(\d{1,2})\s*\/\s*10\D+(\d{1,2})/i);
  if (goal) p.goal = { threshold: Number(goal[1]), runLength: Number(goal[2]) };
  else if (!p.goal && p.name) p.goal = defaultGoal();
  const date = all.match(/\bon (\d{4}-\d{2}-\d{2})\b/)?.[1];
  if (date) {
    p.testDate = date;
    p.testLabel = /unit test/i.test(all) ? "unit test" : "test";
  }

  const fresh = input.attachments.filter((a) => a.kind === "new");
  const extracted = fresh.map((a, i) => ({ attachment: i + 1, label: `Page ${141 + i}`, readable: true, text: `Study notes from ${a.label}.` }));

  const turns = parentTexts.length;
  const ready = turns >= 2 && !!p.name && p.topics.length > 0 && !!p.goal;
  let reply: string;
  if (!p.name) reply = "Tell me the subject and the chapter, and attach the textbook pages if you have them.";
  else if (ready) reply = `Agreed: "${p.name}" with the goal ${goalLabel(p.goal!)}. Press Create track when you are happy.`;
  else
    reply = `I can create a track called "${p.name}" covering ${p.topics.map((t) => t.name).join(", ")}. I suggest the goal ${goalLabel(p.goal ?? defaultGoal())}. Should I change anything?`;
  return { reply, extracted, preview: p, ready };
}

let bankWrites = 0;

export async function fakeWriteQuestions(input: WriteQuestionsInput): Promise<WrittenQuestion[]> {
  // A different "edition" per exam so prompts never repeat the recent ones (rules §4). Pool writes (roadmap 23) get
  // their own numbered edition, and a retry slot is a visibly new wording of the missed question.
  const edition = input.bank ? ` [pool ${++bankWrites}]` : input.avoid.length ? ` [${input.avoid.length / input.plan.length + 1}]` : "";
  return input.plan.map((slot, i) => {
    const topic = input.topics.find((t) => t.key === slot.topicKey)!;
    return slot.type === "multiple_choice"
      ? {
          topicKey: slot.topicKey,
          type: "multiple_choice",
          prompt: slot.retryOf ? `In other words: ${slot.retryOf}${edition}` : `Question ${i + 1} about ${topic.name}: which statement is correct?${edition}`,
          options: [`Correct fact about ${topic.name}`, "A common mistake", "Another mistake", "An unrelated statement"],
          correctIndex: 0,
          expectedAnswer: null,
          explanation: `This is the key fact about ${topic.name}.`,
          difficulty: 2,
        }
      : {
          topicKey: slot.topicKey,
          type: "short",
          prompt: slot.retryOf ? `In other words: ${slot.retryOf}${edition}` : `Question ${i + 1}: name one idea from ${topic.name}.${edition}`,
          options: [],
          correctIndex: null,
          expectedAnswer: `An idea from ${topic.name}`,
          explanation: `Any key idea from ${topic.name}.`,
          difficulty: 2,
        };
  });
}

function titleCase(s: string) {
  return s.trim().replace(/^\w/, (c) => c.toUpperCase());
}

/** Fake marking: right if the answer contains the expected answer's longest word. */
export async function fakeMarkAnswers(answers: AnswerToMark[]): Promise<MarkedAnswer[]> {
  return answers.map((a) => {
    const key = a.expected.toLowerCase().split(/\W+/).sort((x, y) => y.length - x.length)[0] ?? "";
    const correct = !!key && a.given.toLowerCase().includes(key);
    return { key: a.key, correct, reason: correct ? "" : `The answer is ${a.expected}.` };
  });
}

/**
 * Fake update chat. Reads "Chapter N: a, b and c" for new topics and "goal X / 10 in N" for a goal change.
 * Ready once the parent has replied to a proposal.
 */
export async function fakeTrackUpdate(input: TrackUpdateInput): Promise<TrackUpdateOutput> {
  const parentTexts = [...input.history.filter((m) => m.author === "parent").map((m) => m.text), input.message];
  const all = parentTexts.join(" \n ");
  const u = { ...input.update, newTopics: [...input.update.newTopics] };
  const chapter = all.match(/Chapter\s*\d*\s*:?\s*([^.\n]+)/i)?.[1]?.trim();
  if (!u.newTopics.length && chapter) {
    u.newTopics = chapter
      .split(/,|\band\b/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((name) => ({ name: name[0]!.toUpperCase() + name.slice(1), description: `Questions on ${name}.` }));
  }
  const goal = input.message.match(/goal\s*(?:to\s*)?(\d{1,2})\s*\/\s*10\D+(\d{1,2})/i);
  if (goal) u.goal = { threshold: Number(goal[1]), runLength: Number(goal[2]) };
  else if (input.mode === "restart" && !u.goal) u.goal = defaultGoal();
  const fresh = input.attachments.filter((a) => a.kind === "new");
  const extracted = fresh.map((_, i) => ({ attachment: i + 1, label: `Page ${158 + i}`, readable: true, text: "Study notes." }));
  const ready = parentTexts.length >= 2;
  const topics = u.newTopics.map((t) => t.name).join(", ") || "no new topics";
  const goalLine = u.goal ? `the new goal ${goalLabel(u.goal)}; progress starts again at 0` : `the goal stays ${goalLabel(input.track.goal)} with progress ${input.track.goalProgress} of ${input.track.goal.runLength}`;
  const reply = ready
    ? `Agreed. ${input.mode === "restart" ? 'Press "Start the track again".' : 'Press "Apply changes".'}`
    : `I would add ${topics}${input.mode === "restart" ? ", keep the earlier topics as revision" : " from the next exam"}, with ${goalLine}. Shall I go ahead?`;
  return { reply, extracted, update: u, ready };
}

/** Deterministic flashcards: the counts asked for, and one card per missed question. */
export async function fakeWriteFlashcards(input: WriteFlashcardsInput): Promise<WrittenCard[]> {
  const known = new Set(input.knownFronts.map((f) => f.toLowerCase()));
  const cards: WrittenCard[] = [];
  for (const p of input.plan) {
    const name = input.topics.find((t) => t.key === p.topicKey)?.name ?? p.topicKey;
    for (let i = 1, made = 0; made < p.count; i++) {
      const front = `${name}: key idea ${i}?`;
      if (known.has(front.toLowerCase())) continue;
      known.add(front.toLowerCase());
      cards.push({ topicKey: p.topicKey, front, answer: `Answer ${i} on ${name}`, explanation: `Why ${i}: it follows from ${name}.`, missedKey: null });
      made++;
    }
  }
  for (const m of input.missed) {
    cards.push({ topicKey: m.topicKey, front: `In other words: ${m.question}`.slice(0, 200), answer: m.expected.slice(0, 120) || "See the explanation", explanation: (m.explanation || "From your exam.").slice(0, 300), missedKey: m.key });
  }
  return cards;
}

/** A picture for items mentioning an angle or a mirror (the sample scene), none for the rest. */
export async function fakeDrawVisuals(input: DrawVisualsInput): Promise<DrawnVisuals> {
  return new Map(input.items.map((i) => [i.key, /angle|mirror|°/i.test(`${i.prompt} ${i.answer}`) ? sampleVisuals[0]!.scene : null]));
}
