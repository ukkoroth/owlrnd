import { describe, expect, it } from "vitest";
import { rules } from "@/config/rules";
import { awaitingRewording, canFill, needsTopUp, poolCandidates, poolWritePlan, shortfallPlan, type PoolRow } from "./questionPool";
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
  const S = rules.pool.stockPerTopic;
  const count = (plan: { topicKey: string; retryOf?: string }[], k: string) => plan.filter((s) => s.topicKey === k && !s.retryOf).length;

  it("an empty pool: every topic up to its stock, weak topics most, then up to two exams' worth", () => {
    const plan = poolWritePlan(active, [], [], new Map());
    expect(plan).toHaveLength(rules.pool.examsAhead * rules.exam.maxQuestions);
    expect(count(plan, "T1")).toBeGreaterThanOrEqual(S.needs_work);
    expect(count(plan, "T3")).toBeGreaterThanOrEqual(S.not_tested);
    expect(count(plan, "T2")).toBeGreaterThanOrEqual(S.strong);
    expect(count(plan, "T1")).toBeGreaterThan(count(plan, "T2"));
    expect(plan.filter((s) => s.type === "multiple_choice").length).toBeGreaterThanOrEqual(plan.length / 2);
  });

  it("a well-stocked pool with misses waiting: only the new wordings, no new questions (2026-11-20)", () => {
    const misses = Array.from({ length: 5 }, (_, i) => ({ topicKey: "T1", type: "short" as const, prompt: `m${i}` }));
    const plan = poolWritePlan(active, [], misses, new Map([["T1", 40], ["T2", 40], ["T3", 40]]));
    expect(plan).toHaveLength(5);
    expect(plan.every((s) => s.retryOf)).toBe(true);
  });

  it("well stocked overall but short on the weak topic: just enough for that topic", () => {
    const plan = poolWritePlan(active, [], [], new Map([["T1", 1], ["T2", 30], ["T3", 30]]));
    expect(plan.map((s) => s.topicKey)).toEqual(Array(S.needs_work - 1).fill("T1"));
  });

  it("nothing lacking and nothing to reword: no AI call", () => {
    expect(poolWritePlan(active, [], [], new Map([["T1", 10], ["T2", 10], ["T3", 10]]))).toEqual([]);
  });

  it("asks for new wordings first, and keeps them to half the batch", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ topicKey: "T1", type: "short" as const, prompt: `m${i}` }));
    const plan = poolWritePlan(active, [], many, new Map());
    expect(plan.slice(0, rules.pool.batchMax / 2).every((s) => s.retryOf)).toBe(true);
    expect(plan.filter((s) => s.retryOf)).toHaveLength(rules.pool.batchMax / 2);
    expect(plan).toHaveLength(rules.pool.batchMax);
  });
});

describe("shortfallPlan (an exam waiting on the pool)", () => {
  const c = (topic: number) => ({ id: `c${++n}`, topic, type: "multiple_choice" as const, prompt: `p${n}`, explanation: "x", difficulty: 2, options: ["a", "b", "c", "d"], correctIndex: 0 });
  const plan = [...Array(5).fill("T1"), ...Array(3).fill("T2"), ...Array(2).fill("T3")].map((k) => ({ topicKey: k, type: "multiple_choice" as const }));

  it("writes only what each planned topic lacks", () => {
    const have = [c(0), ...Array.from({ length: 6 }, () => c(1)), ...Array.from({ length: 6 }, () => c(2))];
    const out = shortfallPlan(plan, have, keys);
    expect(out.map((s) => s.topicKey)).toEqual(["T1", "T1", "T1", "T1"]);
  });

  it("and enough for a whole paper when the pool is nearly empty", () => {
    const out = shortfallPlan(plan, [c(0)], keys);
    expect(out.length + 1).toBeGreaterThanOrEqual(plan.length);
    expect(out.length).toBeLessThanOrEqual(plan.length);
  });

  it("nothing when the pool can already fill the plan exactly", () => {
    const have = [...Array.from({ length: 5 }, () => c(0)), ...Array.from({ length: 3 }, () => c(1)), ...Array.from({ length: 2 }, () => c(2))];
    expect(shortfallPlan(plan, have, keys)).toEqual([]);
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
