import { describe, expect, it } from "vitest";
import { solarSystem } from "@/content/samples/solarSystem";
import { firstExamPlan, validateWrittenExam, type PlanSlot } from "./examPlan";
import { planWithRevision } from "./examMix";
import { pickFromBank } from "./sampleBank";

const keys = solarSystem.topics.map((_, i) => `T${i + 1}`);
const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

describe("the Solar System sample bank", () => {
  it("every question passes the exam writer's format checks, and no prompt appears twice", () => {
    const all = solarSystem.questions.map((q) => ({ ...q, topicKey: keys[q.topic]!, options: q.options ?? [], correctIndex: q.correctIndex ?? null, expectedAnswer: q.expectedAnswer ?? null }));
    const plan: PlanSlot[] = all.map((q) => ({ topicKey: q.topicKey, type: q.type }));
    expect(validateWrittenExam(plan, all)).toEqual([]);
    expect(new Set(all.map((q) => q.prompt.toLowerCase())).size).toBe(all.length);
  });

  it("covers every topic with enough questions of each type, and short answers are one word", () => {
    solarSystem.topics.forEach((_, t) => {
      const qs = solarSystem.questions.filter((q) => q.topic === t);
      expect(qs.filter((q) => q.type === "multiple_choice").length).toBeGreaterThanOrEqual(6);
      expect(qs.filter((q) => q.type === "short").length).toBeGreaterThanOrEqual(3);
      expect(qs.length).toBeGreaterThanOrEqual(12);
      expect(solarSystem.flashcards.filter((c) => c.topic === t).length).toBeGreaterThanOrEqual(4);
    });
    for (const q of solarSystem.questions.filter((q) => q.type === "short")) expect(q.expectedAnswer).toMatch(/^\S+$/);
  });
});

describe("pickFromBank", () => {
  it("fills the first exam's plan: the planned topic and type for every slot, multiple choice first", () => {
    const plan = firstExamPlan(keys);
    const paper = pickFromBank(plan, solarSystem.questions, keys, [], seeded());
    expect(validateWrittenExam(plan, paper)).toEqual([]);
    expect(paper.findIndex((q) => q.type === "short")).toBeGreaterThan(paper.filter((q) => q.type === "multiple_choice").length - 1);
  });

  it("never repeats a question within one paper, and avoids the last 3 exams while the bank allows", () => {
    const plan = firstExamPlan(keys);
    const recent: string[][] = [];
    for (let n = 0; n < 4; n++) {
      const paper = pickFromBank(plan, solarSystem.questions, keys, recent.slice(0, 3), seeded(n + 1));
      expect(new Set(paper.map((q) => q.prompt)).size).toBe(paper.length);
      const lastThree = new Set(recent.slice(0, 3).flat());
      // 12 questions per topic, at most 3 per topic in a first-exam plan: three exams back never needs a repeat.
      expect(paper.filter((q) => lastThree.has(q.prompt))).toEqual([]);
      recent.unshift(paper.map((q) => q.prompt));
    }
  });

  it("follows an adaptive plan towards a weak topic, and relaxes to the least recently used when the topic runs low", () => {
    const plan = planWithRevision(
      [
        { key: "T1", name: "a", strength: "strong" },
        { key: "T2", name: "b", strength: "needs_work" },
        { key: "T3", name: "c", strength: "strong" },
        { key: "T4", name: "d", strength: "strong" },
      ],
      [],
    );
    const recent = [solarSystem.questions.filter((q) => q.topic === 1).slice(0, 6).map((q) => q.prompt)];
    const paper = pickFromBank(plan, solarSystem.questions, keys, recent, seeded());
    expect(paper).toHaveLength(plan.length);
    const weak = paper.filter((q) => q.topicKey === "T2");
    expect(weak.length).toBe(plan.filter((s) => s.topicKey === "T2").length);
    // Unused T2 questions come before the ones from the last exam.
    const fresh = solarSystem.questions.filter((q) => q.topic === 1).length - 6;
    expect(weak.filter((q) => !recent[0]!.includes(q.prompt)).length).toBe(Math.min(fresh, weak.length));
  });

  it("asks harder questions for a harder slot", () => {
    const paper = pickFromBank([{ topicKey: "T1", type: "multiple_choice", harder: true }], solarSystem.questions, keys, [], seeded());
    const hardest = Math.max(...solarSystem.questions.filter((q) => q.topic === 0 && q.type === "multiple_choice").map((q) => q.difficulty));
    expect(paper[0]!.difficulty).toBe(hardest);
  });
});
