"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { applyUpdate, sendUpdate, startOverUpdate } from "@/app/_actions/tracks";
import { canApplyUpdate, formatTestDate, goalLabel, type Goal, type StoredUpdate, type UpdateMode } from "@/domain/tracks";
import type { ChatMessage } from "@/server/tracks";
import { tracksHref, trackWords, type TrackAudience } from "@/domain/trackView";
import { ChatThread, PanelRows } from "./chat/ChatThread";

type Props = {
  mode: UpdateMode;
  trackId: string;
  audience: TrackAudience;
  trackName: string;
  currentTopics: string[];
  goal: Goal;
  goalProgress: number;
  goalReachedOn: string | null;
  initialMessages: ChatMessage[];
  initialUpdate: StoredUpdate;
};

const list = (xs: string[]) => xs.join(", ");

/**
 * 2j (restart a goal-reached track) and Add material (an active track). The AI explains how the plan changes;
 * nothing changes until whoever controls the track presses the button in the "Track update" panel.
 */
export function TrackUpdateChat(p: Props) {
  const [messages, setMessages] = useState(p.initialMessages);
  const [update, setUpdate] = useState(p.initialUpdate);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applying, startApplying] = useTransition();
  const [discarding, startDiscard] = useTransition();
  const restart = p.mode === "restart";
  const ready = update.ready && canApplyUpdate(p.mode, update);

  const goalRow = (): string => {
    if (restart) return update.goal ? goalLabel(update.goal) : "—";
    return update.goal
      ? `New: ${goalLabel(update.goal)}. Progress starts again at 0.`
      : `Stays: ${goalLabel(p.goal)} · progress ${p.goalProgress} of ${p.goal.runLength}`;
  };
  const rows: [string, string | null][] = restart
    ? [
        ["New topics", update.newTopics.length ? list(update.newTopics.map((t) => t.name)) : null],
        ["Kept as revision", `The ${p.currentTopics.length} earlier ${p.currentTopics.length === 1 ? "topic" : "topics"}, about 2 questions an exam`],
        ["New goal", update.goal ? goalLabel(update.goal) : null],
        ["Previous goal", p.goalReachedOn ? `Reached on ${p.goalReachedOn}` : "Reached"],
      ]
    : [
        ["New topics", update.newTopics.length ? list(update.newTopics.map((t) => t.name)) : messages.length ? "None, more material for the current topics" : null],
        ["Current topics", list(p.currentTopics)],
        ["Goal", goalRow()],
        ...(update.testDate ? ([["Test date", formatTestDate(update.testDate)]] as [string, string][]) : []),
      ];

  const apply = () =>
    startApplying(async () => {
      const res = await applyUpdate(p.trackId);
      if (res.ok) {
        setMessages(res.messages);
        setUpdate(res.update);
        setApplied(true);
      } else setError(res.error);
    });

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
      <ChatThread
        greeting={
          restart ? (
            <p>
              {trackWords(p.audience).who} reached the goal{p.goalReachedOn ? ` on ${p.goalReachedOn}` : ""}: {goalLabel(p.goal)}. What should this track cover next?
            </p>
          ) : (
            <p>
              What would you like to add to {p.trackName}? Attach more {p.audience.kind === "parent" ? "textbook pages" : "pages or notes"}, or tell me the
              topics. I&apos;ll explain how the plan changes before anything is applied.
            </p>
          )
        }
        placeholder={restart ? "Add a chapter, topics or a new test date" : "Add pages, topics or a new test date"}
        messages={messages}
        closed={applied}
        error={error}
        onSend={async (fd) => {
          const res = await sendUpdate(p.trackId, fd);
          if (!res.ok) return res.error;
          setMessages(res.messages);
          setUpdate(res.update);
          return null;
        }}
      />

      <aside aria-label="Track update" className="card sticky top-6 p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="whitespace-nowrap text-[14px] font-bold uppercase tracking-wider">Track update</h2>
          <span className={`whitespace-nowrap rounded px-2 py-1 text-xs font-bold ${applied || ready ? "bg-brand text-white" : "bg-pale text-ink-muted"}`}>
            {applied ? (restart ? "Active again" : "Applied") : ready ? "Ready" : "Draft"}
          </span>
        </div>
        <PanelRows rows={rows} />
        {applied ? (
          <Link href={tracksHref(p.audience)} className="btn-primary mt-4 w-full">
            {trackWords(p.audience).backToTracks}
          </Link>
        ) : (
          <>
            <button type="button" className="btn-primary mt-4 w-full" disabled={!ready || applying} onClick={apply}>
              {applying ? "Applying…" : restart ? "Start the track again" : "Apply changes"}
            </button>
            {!ready && messages.length > 0 && <p className="mt-2 text-[13px] text-ink-muted">Agree the change in the chat first.</p>}
            {messages.length > 0 && (
              <button
                type="button"
                className="link mt-3 block min-h-touch text-sm"
                disabled={discarding}
                onClick={() =>
                  startDiscard(async () => {
                    await startOverUpdate(p.trackId);
                    window.location.reload();
                  })
                }
              >
                Start over
              </button>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
