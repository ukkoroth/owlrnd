import { rules } from "@/config/rules";
import { assignTypes, type PlanSlot } from "./examPlan";
import type { Strength } from "./topicStrength";

export type MixTopic = { key: string; name: string; strength: Strength };
export type Focus = Strength | "revision";
export type MixSlot = PlanSlot & { focus: Focus; harder: boolean };

/**
 * Rules §4, later exams: about 50% needs-work topics, 30% not-tested topics and 20% strong topics as repeats.
 * A category with no topics gives its share to the others; when every topic is strong, all questions are on strong
 * topics at a harder level. At least half multiple choice, multiple choice first.
 */
export type MixOptions = { total: number; mix: { needsWork: number; notTested: number; strong: number } };

export function nextExamPlan(topics: MixTopic[], opts: MixOptions = { total: rules.exam.maxQuestions, mix: rules.exam.mix }): MixSlot[] {
  if (!topics.length) return [];
  const groups: Record<Strength, MixTopic[]> = { needs_work: [], not_tested: [], strong: [] };
  for (const t of topics) groups[t.strength].push(t);

  const shares: Record<Strength, number> = { needs_work: opts.mix.needsWork, not_tested: opts.mix.notTested, strong: opts.mix.strong };
  const present = (Object.keys(groups) as Strength[]).filter((k) => groups[k].length);
  const sum = present.reduce((s, k) => s + shares[k], 0);

  // Largest-remainder rounding so counts add up to exactly `total`.
  const raw = present.map((k) => ({ k, exact: (shares[k] / sum) * opts.total }));
  const counts = new Map(raw.map((r) => [r.k, Math.floor(r.exact)]));
  let left = opts.total - [...counts.values()].reduce((a, b) => a + b, 0);
  for (const r of [...raw].sort((a, b) => (b.exact % 1) - (a.exact % 1))) {
    if (left-- <= 0) break;
    counts.set(r.k, counts.get(r.k)! + 1);
  }

  const allStrong = present.length === 1 && present[0] === "strong";
  const order: { topic: MixTopic; focus: Strength }[] = [];
  for (const k of ["needs_work", "not_tested", "strong"] as Strength[]) {
    const g = groups[k];
    for (let i = 0; i < (counts.get(k) ?? 0); i++) order.push({ topic: g[i % g.length]!, focus: k });
  }

  const types = assignTypes(order.length);
  const slots: MixSlot[] = order.map((o, i) => ({ topicKey: o.topic.key, type: types[i]!, focus: o.focus, harder: allStrong }));
  return sortPaper(slots);
}

const focusRank: Record<Focus, number> = { needs_work: 0, not_tested: 1, strong: 2, revision: 3 };
function sortPaper(slots: MixSlot[]): MixSlot[] {
  const rank = (s: MixSlot) => (s.type === "multiple_choice" ? 0 : 1);
  return slots.sort((a, b) => rank(a) - rank(b) || focusRank[a.focus] - focusRank[b.focus]);
}

/**
 * Rules §3 restart: after the parent adds topics, earlier topics stay as revision with about
 * `revisionQuestionsPerExam` questions per exam (weakest first); the active topics fill the rest with the usual mix
 * (all untested new topics are simply spread evenly).
 */
export function planWithRevision(active: MixTopic[], revision: MixTopic[], total: number = rules.exam.maxQuestions): MixSlot[] {
  if (!revision.length) return nextExamPlan(active, { total, mix: rules.exam.mix });
  if (!active.length) return nextExamPlan(revision, { total, mix: rules.exam.mix });
  const nRevision = Math.min(rules.exam.revisionQuestionsPerExam, total - 1);
  const activeSlots = nextExamPlan(active, { total: total - nRevision, mix: rules.exam.mix });
  const byNeed = [...revision].sort((a, b) => focusRank[a.strength] - focusRank[b.strength]);
  const revisionSlots: MixSlot[] = Array.from({ length: nRevision }, (_, i) => ({
    topicKey: byNeed[i % byNeed.length]!.key,
    type: "short",
    focus: "revision",
    harder: false,
  }));
  // Re-spread the types over the whole paper so it stays at least half multiple choice.
  const all = [...activeSlots, ...revisionSlots];
  const types = assignTypes(all.length);
  all.forEach((s, i) => (s.type = types[i]!));
  return sortPaper(all);
}

/**
 * A topic name inside a sentence: "Resistors in parallel" → "resistors in parallel", but names that start with a
 * proper noun or an abbreviation keep their capital ("Ohm's law", "DNA replication").
 */
export function inSentence(name: string): string {
  const first = name.split(/\s+/)[0] ?? "";
  if (/['’]s$/i.test(first) || /^[A-Z0-9]{2,}/.test(first) || /[A-Z]/.test(first.slice(1))) return name;
  return name.charAt(0).toLowerCase() + name.slice(1);
}

const list = (names: string[]) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

/** The "Your next exam in this track" sentence on 4.1e. */
export function nextExamFocus(examNumber: number, plan: MixSlot[], topics: MixTopic[]): string {
  // In the track's topic order, not the paper's (which puts multiple choice first).
  const names = (focus: Focus) => topics.filter((t) => plan.some((s) => s.focus === focus && s.topicKey === t.key)).map((t) => t.name);
  const weak = names("needs_work");
  const untested = names("not_tested");
  const hasStrong = plan.some((s) => s.focus === "strong");
  const nRevision = plan.filter((s) => s.focus === "revision").length;
  const revision = nRevision ? ` It also has ${nRevision} revision ${nRevision === 1 ? "question" : "questions"} on earlier topics.` : "";
  if (plan.length && plan.every((s) => s.harder)) return `Exam ${examNumber} will have harder questions on all your topics.`;
  if (weak.length) {
    return `Exam ${examNumber} will have more questions on ${list(weak.map(inSentence))}${untested.length ? `, some on ${list(untested.map(inSentence))}` : ""}${hasStrong ? ", with a few repeats from your strong topics" : ""}.${revision}`;
  }
  if (!untested.length) return `Exam ${examNumber} will have a mix of your strong topics.${revision}`;
  return `Exam ${examNumber} will focus on ${list(untested.map(inSentence))}${hasStrong ? ", with a few repeats from your strong topics" : ""}.${revision}`;
}
