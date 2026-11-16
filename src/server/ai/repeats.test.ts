import { beforeEach, describe, expect, it, vi } from "vitest";

// Exams and flashcards rarely repeat each other's wording (rules.flashcards.repeats, owner 2026-11-16).
const generate = vi.fn();
vi.mock("./client", async (orig) => ({ ...(await orig<typeof import("./client")>()), generateStructured: (...a: unknown[]) => generate(...a) }));

const { writeQuestions } = await import("./writeQuestions");
const { writeFlashcards } = await import("./writeFlashcards");

const deck = ["What is the unit of electrical resistance?", "State Ohm's law in words.", "What does an ammeter measure?"];
const q = (prompt: string) => ({ topicKey: "T1", type: "short_answer" as const, prompt, options: [], correctIndex: null, expectedAnswer: "ohm", explanation: "Because.", difficulty: 2 });
const examInput = (n: number) => ({
  audience: "parent" as const,
  trackName: "Physics",
  level: "Class 10",
  topics: [{ key: "T1", name: "Ohm's law", description: "" }],
  focusNotes: null,
  material: "",
  plan: Array.from({ length: n }, () => ({ topicKey: "T1", type: "short_answer" as const })),
  avoid: [],
  deckFronts: deck,
});

beforeEach(() => generate.mockReset());

describe("an exam rarely repeats a flashcard", () => {
  it("one near-copy is fine: no retry", async () => {
    generate.mockResolvedValueOnce({ questions: [q("What is the unit of electrical resistance?"), q("A 6 V battery drives 2 A. Find R.")] });
    await writeQuestions(examInput(2));
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("more than one: written again once, with the clashes listed; the second paper is kept even if it still repeats", async () => {
    const copies = { questions: [q("what is the unit of electrical resistance"), q("State Ohm's law, in words!")] };
    generate.mockResolvedValueOnce(copies).mockResolvedValueOnce(copies);
    const out = await writeQuestions(examInput(2));
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[1]![0].messages[0].content).toContain('repeats the wording of "What is the unit of electrical resistance?"');
    expect(out).toEqual(copies.questions);
  });

  it("the writer sees the deck", async () => {
    generate.mockResolvedValueOnce({ questions: [q("Find R.")] });
    await writeQuestions(examInput(1));
    expect(generate.mock.calls[0]![0].messages[0].content).toContain(`<flashcards>\n${deck.join("\n")}\n</flashcards>`);
  });
});

describe("a card rarely repeats an exam question", () => {
  const input = {
    audience: "learner" as const,
    trackName: "Physics",
    level: "a learner",
    topics: [{ key: "T1", name: "Ohm's law", description: "" }],
    material: "",
    plan: [{ topicKey: "T1", count: 1 }],
    missed: [{ key: "M1", topicKey: "T1", question: "What is the unit of electrical resistance?", expected: "ohm", explanation: "" }],
    knownFronts: [],
    examQuestions: ["State Ohm's law in words."],
  };
  const card = (front: string, missedKey: string | null = null) => ({ topicKey: "T1", front, answer: "a", explanation: "b", missedKey });

  it("copying both the missed question and an exam question gets one retry", async () => {
    const copies = { cards: [card("State Ohm's law in words"), card("What is the unit of electrical resistance?", "M1")] };
    const fresh = { cards: [card("V = I × what?"), card("Resistance is measured in…", "M1")] };
    generate.mockResolvedValueOnce(copies).mockResolvedValueOnce(fresh);
    expect(await writeFlashcards(input)).toEqual(fresh.cards);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[0]![0].messages[0].content).toContain("<exam_questions>\nState Ohm's law in words.\n</exam_questions>");
  });
});
