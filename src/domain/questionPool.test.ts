import { describe, expect, it } from "vitest";
import { rules } from "@/config/rules";
import { awaitingRewording, canFill, needsTopUp, poolCandidates, poolWritePlan, type PoolRow } from "./questionPool";
import { pickFromBank } from "./sampleBank";

const keys = ["T1", "T2", "T3"];
let n = 0;
const row = (over: Partial<PoolRow> = {}): PoolRow => {
  const id = `q${++n}`;
  return { id, topicKey: "T1", type: "multiple_choice", prompt: `Prompt ${id}`, options: ["a", "b", "c", "d"], correctIndex: 0, expectedAnswer: null, explanation: "x", difficulty: 2, group: id, used: false, missed: false, reworded: false, ...over };
};

describe("poolCandidates (question pool, roadmap 23)", () => {
  it("offers unused questions only: never one already on an exam, right or missed", () => {
    const fresh = row();
    const right = row({ used: true });
    const missed = row({ used: true, missed: true });
    expect(poolCandidates([fresh, right, missed], [], keys).map((c) => c.id)).toEqual([fresh.id]);
  });

  it("a rewording of a missed question waits until its idea is out of the last 3 exams", () => {
    const original = row({ used: true, missed: true, reworded: true });
    const reworded = row({ group: original.id, prompt: "Same idea, new words" });
    expect(poolCandidates([original, reworded], [[original.id]], keys)).toEqual([]);
    expect(poolCandidates([original, reworded], [["a"], ["b"], ["c"]], keys).map((c) => c.id)).toEqual([reworded.id]);
  });

  it("skips questions on topics the track no longer has", () => {
    expect(poolCandidates([row({ topicKey: "T9" })], [], keys)).toEqual([]);
  });

  it("lists missed questions still waiting for new words", () => {
    const waiting = row({ used: true, missed: true });
    expect(awaitingRewording([waiting, row({ used: true, missed: true, reworded: true }), row()])).toEqual([waiting]);
  });
});

describe("canFill and needsTopUp", () => {
  const plan = [
    { topicKey: "T1", type: "multiple_choice" as const },
    { topicKey: "T1", type: "multiple_choice" as const },
    { topicKey: "T2", type: "short" as const },
  ];
  it("needs enough questions overall and half of each planned topic's slots", () => {
    const c = (topic: number) => ({ id: `c${++n}`, topic, type: "multiple_choice" as const, prompt: `p${n}`, explanation: "x", difficulty: 2, options: ["a", "b", "c", "d"], correctIndex: 0 });
    expect(canFill(plan, [c(0), c(1), c(2)], keys)).toBe(true);
    expect(canFill(plan, [c(0), c(2), c(2)], keys)).toBe(false); // nothing on T2
    expect(canFill(plan, [c(0), c(1)], keys)).toBe(false); // too few
  });
  it("tops up when stock is low or misses pile up", () => {
    expect(needsTopUp(rules.pool.lowWater - 1, 0)).toBe(true);
    expect(needsTopUp(rules.pool.lowWater, rules.pool.rewordAfterMisses)).toBe(true);
    expect(needsTopUp(rules.pool.lowWater, 0)).toBe(false);
  });
});

describe("poolWritePlan", () => {
  const active = [
    { key: "T1", name: "a", strength: "needs_work" as const },
    { key: "T2", name: "b", strength: "strong" as const },
    { key: "T3", name: "c", strength: "not_tested" as const },
  ];
  it("asks for new wordings of misses first, then a mix weighted to weak topics, every topic at least the minimum", () => {
    const plan = poolWritePlan(active, [], [{ topicKey: "T2", type: "short", prompt: "Missed one" }], 20);
    expect(plan[0]).toEqual({ topicKey: "T2", type: "short", retryOf: "Missed one" });
    expect(plan).toHaveLength(rules.pool.batchMax);
    const count = (k: string) => plan.slice(1).filter((s) => s.topicKey === k).length;
    expect(count("T1")).toBeGreaterThan(count("T3"));
    expect(count("T3")).toBeGreaterThan(count("T2"));
    for (const k of keys) expect(count(k)).toBeGreaterThanOrEqual(rules.pool.minPerTopic);
    const fresh = plan.slice(1);
    expect(fresh.filter((s) => s.type === "multiple_choice").length).toBeGreaterThanOrEqual(fresh.length / 2);
  });
  it("keeps rewordings to half the batch", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ topicKey: "T1", type: "short" as const, prompt: `m${i}` }));
    const plan = poolWritePlan(active, [], many, 20);
    expect(plan.filter((s) => s.retryOf)).toHaveLength(rules.pool.batchMax / 2);
    expect(plan).toHaveLength(rules.pool.batchMax);
  });
});

describe("picking an exam from the pool", () => {
  it("returns each picked question's id, so the existing row is used", () => {
    const rows = Array.from({ length: 12 }, (_, i) => row({ topicKey: keys[i % 3]!, type: i % 2 ? "short" : "multiple_choice", expectedAnswer: i % 2 ? "x" : null, correctIndex: i % 2 ? null : 0, options: i % 2 ? [] : ["a", "b", "c", "d"] }));
    const candidates = poolCandidates(rows, [], keys);
    const plan = keys.flatMap((k) => [{ topicKey: k, type: "multiple_choice" as const }, { topicKey: k, type: "short" as const }]);
    const paper = pickFromBank(plan, candidates, keys, []);
    expect(paper).toHaveLength(6);
    expect(new Set(paper.map((q) => q.sourceId)).size).toBe(6);
    expect(paper.every((q) => rows.some((r) => r.id === q.sourceId))).toBe(true);
  });
});
