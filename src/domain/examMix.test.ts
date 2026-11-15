import { describe, expect, it } from "vitest";
import { inSentence, nextExamFocus, nextExamPlan, type MixTopic } from "./examMix";

const t = (key: string, strength: MixTopic["strength"], name = key): MixTopic => ({ key, name, strength });
const count = (plan: ReturnType<typeof nextExamPlan>, f: (s: (typeof plan)[number]) => boolean) => plan.filter(f).length;

describe("nextExamPlan (rules §4, later exams)", () => {
  it("is about 50% needs work, 30% not tested, 20% strong", () => {
    const plan = nextExamPlan([t("A", "needs_work"), t("B", "not_tested"), t("C", "strong")]);
    expect(plan).toHaveLength(10);
    expect(count(plan, (s) => s.focus === "needs_work")).toBe(5);
    expect(count(plan, (s) => s.focus === "not_tested")).toBe(3);
    expect(count(plan, (s) => s.focus === "strong")).toBe(2);
  });

  it("gives an empty category's share to the others", () => {
    const plan = nextExamPlan([t("A", "needs_work"), t("C", "strong")]); // 50:20 → 7:3
    expect(count(plan, (s) => s.focus === "needs_work")).toBe(7);
    expect(count(plan, (s) => s.focus === "strong")).toBe(3);
  });

  it("spreads a category over its topics", () => {
    const plan = nextExamPlan([t("A", "needs_work"), t("B", "needs_work"), t("C", "strong")]);
    expect(count(plan, (s) => s.topicKey === "A")).toBeGreaterThanOrEqual(3);
    expect(count(plan, (s) => s.topicKey === "B")).toBeGreaterThanOrEqual(3);
  });

  it("asks harder questions when every topic is strong", () => {
    const plan = nextExamPlan([t("A", "strong"), t("B", "strong")]);
    expect(plan).toHaveLength(10);
    expect(plan.every((s) => s.harder && s.focus === "strong")).toBe(true);
  });

  it("is at least half multiple choice, multiple choice first, never more than 10", () => {
    const plan = nextExamPlan([t("A", "needs_work"), t("B", "not_tested"), t("C", "strong"), t("D", "needs_work")]);
    expect(plan.length).toBeLessThanOrEqual(10);
    expect(count(plan, (s) => s.type === "multiple_choice")).toBeGreaterThanOrEqual(5);
    const firstShort = plan.findIndex((s) => s.type === "short");
    expect(plan.slice(firstShort).every((s) => s.type === "short")).toBe(true);
  });
});

describe("nextExamFocus (4.1e)", () => {
  it("names the weak topics first", () => {
    const topics = [t("A", "needs_work", "Resistors in parallel"), t("B", "needs_work", "Power and energy"), t("C", "strong", "Ohm's law")];
    expect(nextExamFocus(3, nextExamPlan(topics), topics)).toBe(
      "Exam 3 will have more questions on resistors in parallel and power and energy, with a few repeats from your strong topics.",
    );
  });
  it("talks about harder questions when everything is strong", () => {
    const topics = [t("A", "strong", "Ohm's law")];
    expect(nextExamFocus(4, nextExamPlan(topics), topics)).toBe("Exam 4 will have harder questions on all your topics.");
  });
});

describe("inSentence", () => {
  it("lower-cases ordinary topic names but keeps proper nouns and abbreviations", () => {
    expect(inSentence("Resistors in parallel")).toBe("resistors in parallel");
    expect(inSentence("Ohm's law")).toBe("Ohm's law");
    expect(inSentence("DNA replication")).toBe("DNA replication");
    expect(inSentence("pH scale")).toBe("pH scale");
  });
});

import { planWithRevision } from "./examMix";

describe("planWithRevision (rules §3 restart)", () => {
  const fresh = [t("N1", "not_tested", "Magnetic field lines"), t("N2", "not_tested", "Electromagnets")];
  const old = [t("O1", "strong", "Ohm's law"), t("O2", "needs_work", "Resistors in parallel")];
  it("has about 2 revision questions, weakest earlier topic first, and spreads the new topics evenly", () => {
    const plan = planWithRevision(fresh, old);
    expect(plan).toHaveLength(10);
    const rev = plan.filter((s) => s.focus === "revision");
    expect(rev).toHaveLength(2);
    expect(rev.map((s) => s.topicKey).sort()).toEqual(["O1", "O2"]);
    expect(plan.filter((s) => s.topicKey === "N1")).toHaveLength(4);
    expect(plan.filter((s) => s.topicKey === "N2")).toHaveLength(4);
    expect(plan.filter((s) => s.type === "multiple_choice").length).toBeGreaterThanOrEqual(5);
  });
  it("mentions revision in the next-exam sentence", () => {
    const all = [...fresh, ...old];
    expect(nextExamFocus(6, planWithRevision(fresh, old), all)).toBe(
      "Exam 6 will focus on magnetic field lines and electromagnets. It also has 2 revision questions on earlier topics.",
    );
  });
});
