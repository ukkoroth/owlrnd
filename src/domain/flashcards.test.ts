import { describe, expect, it } from "vitest";
import { dueAfter, nextBox, planStarter, planTopUp, validateCards, type DeckTopic } from "./flashcards";

const topic = (key: string, over: Partial<DeckTopic> = {}): DeckTopic => ({ key, strength: "not_tested", revision: false, existing: 0, ...over });

describe("planStarter", () => {
  it("about 6 per active topic and 2 per revision topic, counting cards they have", () => {
    expect(planStarter([topic("T1"), topic("T2", { existing: 4 }), topic("T3", { revision: true })], 0)).toEqual([
      { topicKey: "T1", count: 6 },
      { topicKey: "T2", count: 2 },
      { topicKey: "T3", count: 2 },
    ]);
  });
  it("at most 60 in one go, and never past 200 in the deck", () => {
    const many = Array.from({ length: 12 }, (_, i) => topic(`T${i + 1}`));
    expect(planStarter(many, 0).reduce((s, x) => s + x.count, 0)).toBe(60);
    expect(planStarter(many, 195).reduce((s, x) => s + x.count, 0)).toBe(5);
    expect(planStarter(many, 200)).toEqual([]);
  });
});

describe("planTopUp", () => {
  it("gives more cards to weak and untested topics, and to topics with fewer cards", () => {
    const plan = planTopUp([topic("W", { strength: "needs_work" }), topic("N"), topic("S", { strength: "strong", existing: 12 }), topic("R", { revision: true })], 20);
    const count = (k: string) => plan.find((p) => p.topicKey === k)?.count ?? 0;
    expect(plan.reduce((s, x) => s + x.count, 0)).toBe(10);
    expect(count("W")).toBeGreaterThan(count("N"));
    expect(count("N")).toBeGreaterThan(count("S"));
    expect(count("R")).toBe(0);
  });
  it("nothing when the deck is full", () => expect(planTopUp([topic("W")], 200)).toEqual([]));
});

describe("validateCards", () => {
  const ok = { topicKey: "T1", front: "What is the unit of resistance?", answer: "Ohm", explanation: "Resistance is measured in ohms (Ω).", missedKey: null };
  it("accepts good cards and refuses unknown topics, empty or long fields, and repeats", () => {
    expect(validateCards([ok], ["T1"], [])).toEqual([]);
    expect(validateCards([{ ...ok, topicKey: "T9" }], ["T1"], [])).toHaveLength(1);
    expect(validateCards([{ ...ok, answer: "" }], ["T1"], [])).toHaveLength(1);
    expect(validateCards([{ ...ok, front: "x".repeat(201) }], ["T1"], [])).toHaveLength(1);
    expect(validateCards([ok], ["T1"], ["what is the UNIT of resistance"])).toHaveLength(1);
    expect(validateCards([ok, ok], ["T1"], [])).toHaveLength(1);
    expect(validateCards([{ ...ok, missedKey: "M1" }], ["T1"], [], ["M1"])).toEqual([]);
  });

  it("tells cards apart in Hindi and other scripts, and still catches real repeats (bug of 2026-11-16)", () => {
    const hi = (front: string) => ({ ...ok, front });
    const deck = [hi("मैम के पूछने पर आदिल ने कक्षा में क्या उत्तर दिया?"), hi("सुशांत ने हाथ उठाकर डॉ॰ अय्यर से कौन-सी बात जाननी चाही?"), hi("कहानी का मुख्य पात्र कौन है?")];
    expect(validateCards(deck, ["T1"], [])).toEqual([]);
    expect(validateCards([...deck, hi("कहानी का मुख्य पात्र कौन है")], ["T1"], [])).toHaveLength(1);
    expect(validateCards([hi("कहानी का मुख्य पात्र कौन है?")], ["T1"], ["कहानी का मुख्य पात्र कौन है ?"])).toHaveLength(1);
    // Vowel signs matter: these differ only in a matra.
    expect(validateCards([hi("कल"), hi("काल")], ["T1"], [])).toEqual([]);
  });
});

describe("spaced repetition", () => {
  const now = new Date("2026-11-16T09:00:00Z");
  it("Got it moves up a box (to 5 at most); Not yet goes back to box 1", () => {
    expect(nextBox(1, "got_it")).toBe(2);
    expect(nextBox(5, "got_it")).toBe(5);
    expect(nextBox(4, "not_yet")).toBe(1);
  });
  it("due again after 1, 2, 4, 8, 16 days", () => {
    expect(dueAfter(1, now).toISOString()).toBe("2026-11-17T09:00:00.000Z");
    expect(dueAfter(5, now).toISOString()).toBe("2026-12-02T09:00:00.000Z");
  });
});

describe("near-copies between exams and cards (rules.flashcards.repeats)", () => {
  it("same words, ignoring case and punctuation, count; a different value or a new question doesn't", async () => {
    const { sameWording, repeatsOf, tooManyRepeats } = await import("./flashcards");
    expect(sameWording("What is the unit of resistance?", "what is the UNIT of resistance")).toBe(true);
    expect(sameWording("A 6 V battery drives 2 A. Find R.", "A 6 V battery drives 3 A. Find R.")).toBe(false);
    expect(sameWording("What is the unit of resistance?", "Why does resistance rise with temperature?")).toBe(false);
    expect(repeatsOf(["a b c d e", "x y"], ["A, b, c, d, e."])).toEqual([{ index: 0, like: "A, b, c, d, e." }]);
    expect(tooManyRepeats(["a b c d e"], ["a b c d e"], "Question")).toEqual([]); // one is allowed: "rarely"
    expect(tooManyRepeats(["a b c d e", "f g h i j"], ["a b c d e", "f g h i j"], "Question")).toHaveLength(2);
  });
});

describe("F3: counts, card states and points", () => {
  it("the Practise count: due cards up to a session; none due → the top-up; an empty or full deck with none due → no button", async () => {
    const { practiseCount } = await import("./flashcards");
    expect(practiseCount({ total: 30, due: 4 })).toBe(4);
    expect(practiseCount({ total: 30, due: 25 })).toBe(10);
    expect(practiseCount({ total: 30, due: 0 })).toBe(10);
    expect(practiseCount({ total: 0, due: 0 })).toBeNull(); // starter deck still being written
    expect(practiseCount({ total: 200, due: 0 })).toBeNull();
  });

  it("card states: due now → to practise; otherwise known from box 4", async () => {
    const { cardState } = await import("./flashcards");
    const now = new Date("2026-11-16T10:00:00Z");
    const later = new Date("2026-11-17T10:00:00Z");
    expect(cardState({ box: 5, dueAt: now }, now)).toBe("to_practise");
    expect(cardState({ box: 3, dueAt: later }, now)).toBe("learning");
    expect(cardState({ box: 4, dueAt: later }, now)).toBe("known");
  });

  it("points: 5 for a session of 8+ cards, at most 2 a day per track, none per card", async () => {
    const { sessionPoints } = await import("./flashcards");
    expect(sessionPoints(10, 0)).toBe(5);
    expect(sessionPoints(8, 1)).toBe(5);
    expect(sessionPoints(7, 0)).toBe(0);
    expect(sessionPoints(10, 2)).toBe(0);
  });
});

describe("the parent's line (fc-7)", () => {
  it("sessions in the last 7 days and cards known, overall or of the track's deck", async () => {
    const { cardsLine } = await import("./flashcards");
    expect(cardsLine(3, 41)).toBe("3 sessions in the last 7 days · 41 cards known");
    expect(cardsLine(1, 1)).toBe("1 session in the last 7 days · 1 card known");
    expect(cardsLine(0, 12, 24)).toBe("0 sessions in the last 7 days · 12 of 24 cards known");
  });
});
