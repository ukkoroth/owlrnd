import { describe, expect, it } from "vitest";
import { emptyPreview } from "@/domain/tracks";
import { buildTrackChatRequest } from "./trackChat";
import { updateSystem } from "./trackUpdate";
import { systemFor as writeQuestionsSystem } from "./writeQuestions";
import { checkFlashcards, flashcardsSystem } from "./writeFlashcards";

// The learner's prompts speak to the learner: no "parent" or "child" anywhere (0.2 plan, M9).
describe("prompts for a self-managed learner", () => {
  const input = {
    audience: "learner" as const,
    parentName: "Rancho",
    studentName: "Rancho",
    className: "",
    today: "2026-11-16",
    mode: "first" as const,
    preview: emptyPreview,
    history: [{ author: "parent" as const, text: "JEE Physics, current electricity." }],
    attachments: [],
    message: "Exam in January.",
  };

  it("the track chat prompt never mentions a parent or a child", () => {
    const { system, content } = buildTrackChatRequest(input);
    const text = [system, ...content.map((b) => ("text" in b ? b.text : ""))].join("\n");
    expect(text).not.toMatch(/parent|child/i);
    expect(text).toContain("Learner: Rancho");
    expect(text).toContain("Learner: JEE Physics");
  });

  it("the parent's prompt is unchanged", () => {
    const { system, content } = buildTrackChatRequest({ ...input, audience: "parent", parentName: "Atticus", studentName: "Scout", className: "Class 10" });
    expect(system).toContain("You help a parent set up");
    expect(content.map((b) => ("text" in b ? b.text : "")).join("\n")).toContain("Child: Scout, Class 10");
  });

  it("the update and question-writing prompts never mention a parent or a child either", () => {
    for (const mode of ["restart", "add"] as const) expect(updateSystem(mode, "learner")).not.toMatch(/parent|child/i);
    expect(writeQuestionsSystem("learner")).not.toMatch(/parent|child/i);
    expect(updateSystem("add", "parent")).toContain("A parent is changing");
    expect(writeQuestionsSystem("parent")).toContain("for school students");
  });
});

describe("flashcard writer (0.3)", () => {
  it("the learner's prompt never mentions a parent or a child", () => {
    expect(flashcardsSystem("learner")).not.toMatch(/parent|child/i);
    expect(flashcardsSystem("parent")).toContain("school student");
  });
  it("checks the counts per topic and one card per missed question", () => {
    const input = {
      audience: "learner" as const,
      trackName: "Physics: Ohm's law",
      level: "x",
      topics: [{ key: "T1", name: "Ohm's law", description: "" }],
      material: "",
      plan: [{ topicKey: "T1", count: 2 }],
      missed: [{ key: "M1", topicKey: "T1", question: "Unit of resistance?", expected: "ohm", explanation: "" }],
      knownFronts: [],
    };
    const card = (front: string, missedKey: string | null = null) => ({ topicKey: "T1", front, answer: "a", explanation: "b", missedKey });
    expect(checkFlashcards(input, [card("One?"), card("Two?"), card("Three?", "M1")])).toEqual([]);
    expect(checkFlashcards(input, [card("One?"), card("Three?", "M1")])).toHaveLength(1);
    expect(checkFlashcards(input, [card("One?"), card("Two?")])).toHaveLength(1);
  });
});
