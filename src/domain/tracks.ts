import { rules } from "@/config/rules";

export type Goal = { threshold: number; runLength: number };
export type TopicDraft = { name: string; description: string };

/** What the chat's preview panel shows (2e, 2f). Filled in by the AI as the parent and AI agree. */
export type TrackPreview = {
  name: string | null;
  topics: TopicDraft[];
  /** ISO date (YYYY-MM-DD) or null when there is no test. */
  testDate: string | null;
  /** e.g. "unit test", "half-yearly exam". */
  testLabel: string | null;
  goal: Goal | null;
  focusNotes: string | null;
};

export const emptyPreview: TrackPreview = { name: null, topics: [], testDate: null, testLabel: null, goal: null, focusNotes: null };

/** Rules §3: "score X / 10 or better in N exams in a row". */
/** "8 / 10 or better in 3 exams in a row, with every topic strong" (rules §3; the coverage part from 0.2). */
export function goalLabel({ threshold, runLength }: Goal, coverage: "all_strong" | "all_tested" | "off" = rules.goal.coverage): string {
  const run = `${threshold} / 10 or better in ${runLength} ${runLength === 1 ? "exam" : "exams in a row"}`;
  return coverage === "all_strong" ? `${run}, with every topic strong` : coverage === "all_tested" ? `${run}, with every topic tested` : run;
}

export function defaultGoal(): Goal {
  return { threshold: rules.goal.defaultThreshold, runLength: rules.goal.defaultRunLength };
}

export function isValidGoal(g: Goal | null): g is Goal {
  return !!g && Number.isInteger(g.threshold) && Number.isInteger(g.runLength) && g.threshold >= 1 && g.threshold <= 10 && g.runLength >= 1 && g.runLength <= 10;
}

/** "YYYY-MM-DD" that is a real calendar date. */
export function isIsoDate(s: string | null): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** "Fri 20 Nov" (2f, 2g). Dates are calendar days, so format in UTC to avoid shifting a day. */
export function formatTestDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
    .format(new Date(`${iso}T00:00:00Z`))
    .replace(",", "");
}

/** Rules §2: the preview must name the track, list topics and agree a goal before Create track is enabled. */
export function canCreateTrack(p: TrackPreview): boolean {
  return (
    !!p.name?.trim() &&
    p.name.trim().length <= rules.track.maxNameLength &&
    p.topics.length >= 1 &&
    p.topics.length <= rules.track.maxTopics &&
    p.topics.every((t) => t.name.trim().length > 0) &&
    isValidGoal(p.goal) &&
    (p.testDate === null || isIsoDate(p.testDate))
  );
}

export type TrackStatus = "draft" | "active" | "paused" | "goal_reached" | "archived";

/** The small line above a track's name on its card, e.g. "New · unit test on Fri 20 Nov" (2g). */
export function trackStatusLine(t: { status: TrackStatus; examsTaken: number; testDate: string | null; testLabel: string | null }): string {
  const word =
    t.status === "paused" ? "Paused" : t.status === "goal_reached" ? "Goal reached · stopped" : t.status === "archived" ? "Archived" : t.examsTaken === 0 ? "New" : "Active";
  return t.testDate ? `${word} · ${t.testLabel ?? "test"} on ${formatTestDate(t.testDate)}` : word;
}

/** The preview as stored with each AI turn, plus whether the parent has agreed to it. */
export type StoredPreview = TrackPreview & { ready: boolean };

const clip = (s: string | null | undefined, max: number) => {
  const t = (s ?? "").trim().replace(/\s+/g, " ");
  return t ? t.slice(0, max) : null;
};

/**
 * Cleans what the AI proposes before the app trusts it (docs/07-ai.md: validate before use):
 * caps topics, drops duplicates, rejects past or invalid test dates and out-of-range goals.
 */
export function sanitizePreview(raw: TrackPreview, today: string): TrackPreview {
  const seen = new Set<string>();
  const topics: TopicDraft[] = [];
  for (const t of raw.topics) {
    const name = clip(t.name, 80);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    topics.push({ name, description: clip(t.description, 200) ?? "" });
    if (topics.length === rules.track.maxTopics) break;
  }
  const testDate = isIsoDate(raw.testDate) && raw.testDate >= today ? raw.testDate : null;
  return {
    name: clip(raw.name, rules.track.maxNameLength),
    topics,
    testDate,
    testLabel: testDate ? clip(raw.testLabel, 40) : null,
    goal: isValidGoal(raw.goal) ? { threshold: raw.goal.threshold, runLength: raw.goal.runLength } : null,
    focusNotes: clip(raw.focusNotes, 500),
  };
}

/** "YYYY-MM-DD" for now in a time zone. */
export function todayIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

// ── Updating a live track (2j restart, Add material) ───────────────────────

export type UpdateMode = "restart" | "add";

/** What an update chat proposes. `goal: null` keeps the current goal (and its progress). */
export type TrackUpdate = {
  newTopics: TopicDraft[];
  goal: Goal | null;
  testDate: string | null;
  testLabel: string | null;
};
export type StoredUpdate = TrackUpdate & { ready: boolean; applied?: boolean };

export const emptyUpdate: TrackUpdate = { newTopics: [], goal: null, testDate: null, testLabel: null };

/** Cleans the AI's proposed update: drops topics the track already has, caps new topics, checks goal and date. */
export function sanitizeUpdate(raw: TrackUpdate, existingTopicNames: string[], today: string): TrackUpdate {
  const have = new Set(existingTopicNames.map((n) => n.trim().toLowerCase()));
  const cleaned = sanitizePreview({ name: "x", topics: raw.newTopics, testDate: raw.testDate, testLabel: raw.testLabel, goal: raw.goal, focusNotes: null }, today);
  return {
    newTopics: cleaned.topics.filter((t) => !have.has(t.name.toLowerCase())),
    goal: cleaned.goal,
    testDate: cleaned.testDate,
    testLabel: cleaned.testLabel,
  };
}

/** Rules §3: a restart needs new topics and a new goal. Adding material can be just pages, topics or a goal change. */
export function canApplyUpdate(mode: UpdateMode, u: TrackUpdate): boolean {
  if (u.goal && !isValidGoal(u.goal)) return false;
  return mode === "restart" ? u.newTopics.length > 0 && !!u.goal : true;
}
