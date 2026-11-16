"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createTrack, sendTurn, startOver } from "@/app/_actions/tracks";
import { rules } from "@/config/rules";
import { canCreateTrack, formatTestDate, goalLabel, missingForTrack, type StoredPreview } from "@/domain/tracks";
import { tracksHref, trackWords, type TrackAudience } from "@/domain/trackView";
import type { ChatMessage } from "@/server/tracks";
import { ChatThread, MobileActionBar, PanelRows, SIDE_CARD, SIDE_CARD_BODY, SIDE_CARD_FOOT } from "./chat/ChatThread";

type Props = {
  /** The learner the track is for (the learner themselves, when self-managed). */
  studentId: string;
  audience: TrackAudience;
  /** First name of whoever is chatting: the parent, or the learner. */
  firstName: string;
  isFirst: boolean;
  initialMessages: ChatMessage[];
  initialPreview: StoredPreview;
};

const PARENT_STARTERS = [
  ["A chapter for an upcoming unit test", "Unit test on <date>. Subject: <subject>. Chapter: <chapter and its topics>."],
  ["Revision for the half-yearly exams", "Half-yearly exams start on <date>. Subject: <subject>. Revise: <chapters>."],
  ["Practice from textbook pages I will attach", "Subject: <subject>. Practice from the attached textbook pages."],
] as const;

/** sm-2d. */
const LEARNER_STARTERS = [
  ["A chapter from my exam syllabus", "Exam: <exam and date>. Subject: <subject>. Chapter: <chapter and its topics>."],
  ["Revision before a mock test", "Mock test on <date>. Subject: <subject>. Revise: <chapters>."],
  ["Practice from notes I will attach", "Exam: <exam>. Subject: <subject>. Practice from the attached notes."],
] as const;

/** The track chat (2e start, 2f agreed): messages on the left, the track preview on the right. */
export function TrackChat({ studentId, audience, firstName, isFirst: isFirstProp, initialMessages, initialPreview }: Props) {
  const words = trackWords(audience);
  // Fixed at first render: once this track is created the student has a track, but this chat was still the first.
  const [isFirst] = useState(isFirstProp);
  const [messages, setMessages] = useState(initialMessages);
  const [preview, setPreview] = useState(initialPreview);
  const [createdTrackId, setCreatedTrackId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, startCreating] = useTransition();

  const create = () =>
    startCreating(async () => {
      const res = await createTrack(studentId);
      if (res.ok) {
        setMessages(res.messages);
        setPreview(res.preview);
        setCreatedTrackId(res.trackId);
      } else setError(res.error);
    });

  // Owner, 2026-11-16: Create track works as soon as the minimum is in; the chat can keep refining until then.
  const ready = canCreateTrack(preview);

  return (
    <div className={`grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_260px] ${ready && !createdTrackId ? "pb-24 lg:pb-0" : ""}`}>
      <ChatThread
        greeting={
          <>
            <p className="font-semibold">
              Hi {firstName}. Let&apos;s create {isFirst ? words.firstTrack : words.newTrack}.
            </p>
            {audience.kind === "parent" ? (
              <p className="mt-2">
                Tell me what {audience.studentName} is studying: the subject, the chapter, and any test coming up with its date. If you have them, attach
                photos of the textbook pages or the syllabus. I will find the topics and suggest a goal for the track.
              </p>
            ) : (
              <p className="mt-2">
                Tell me which exam you are preparing for, the subject and chapters to start with, and your exam date. If you have them, attach the syllabus,
                your notes or a past paper. I will find the topics and suggest a goal for the track.
              </p>
            )}
          </>
        }
        starters={audience.kind === "parent" ? PARENT_STARTERS : LEARNER_STARTERS}
        placeholder="Describe the track: a subject, a chapter, a test date"
        messages={messages}
        closed={!!createdTrackId}
        error={error}
        onSend={async (fd) => {
          const res = await sendTurn(studentId, fd);
          if (!res.ok) return res.error;
          setMessages(res.messages);
          setPreview(res.preview);
          return null;
        }}
      />

      <PreviewPanel
        preview={preview}
        ready={ready}
        created={!!createdTrackId}
        creating={creating}
        studentId={studentId}
        audience={audience}
        hasDraft={messages.length > 0}
        onCreate={create}
      />
    </div>
  );
}

function PreviewPanel(props: {
  preview: StoredPreview;
  ready: boolean;
  created: boolean;
  creating: boolean;
  studentId: string;
  audience: TrackAudience;
  hasDraft: boolean;
  onCreate: () => void;
}) {
  const { preview: p, ready, created } = props;
  const [discarding, startDiscard] = useTransition();
  const rows: [string, string | null][] = [
    ["Name", p.name],
    // A long list would push the goal and the button out of view: the first few, and how many more (all in the chat).
    ["Topics found", p.topics.length ? topicSummary(p.topics.map((t) => t.name)) : null],
    ["Each exam", `Up to ${rules.exam.maxQuestions} questions, multiple choice and short answers`],
    [props.audience.kind === "parent" ? "Test date" : "Exam date", p.testDate ? formatTestDate(p.testDate) : null],
    ["Goal", p.goal ? `${goalLabel(p.goal)}. The track stops when it is reached.` : null],
  ];
  return (
    <aside aria-label="New track preview" className={SIDE_CARD}>
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <h2 className="text-[15px] font-bold uppercase tracking-wider">New track</h2>
        <span className={`rounded px-2 py-1 text-xs font-bold ${ready || created ? "bg-brand text-white" : "bg-pale text-ink-muted"}`}>
          {ready || created ? "Ready" : "Draft"}
        </span>
      </div>
      {!props.hasDraft && <p className="mb-2 shrink-0 text-sm text-ink-muted">Fills in as you chat.</p>}
      <div className={SIDE_CARD_BODY}>
        <PanelRows rows={rows} needed={props.hasDraft && !created ? missingForTrack(p) : []} />
      </div>
      <div className={SIDE_CARD_FOOT}>
      {created ? (
        <Link href={`${tracksHref(props.audience)}?created=1`} className="btn-primary mt-4 w-full">
          {trackWords(props.audience).openTracks}
        </Link>
      ) : (
        <>
          <button type="button" className="btn-primary mt-4 w-full" disabled={!ready || props.creating} onClick={props.onCreate}>
            {props.creating ? "Creating…" : "Create track"}
          </button>
          {!ready && props.hasDraft && (
            <p className="mt-2 text-[13px] font-semibold text-danger-text">
              Still needed: {missingForTrack(p).map((m) => (m === "Topics found" ? "topics" : m.toLowerCase())).join(", ")}. Add them in the chat.
            </p>
          )}
          {ready && !props.creating && <p className="mt-2 text-[13px] text-ink-muted">You can create it now, or keep changing it in the chat.</p>}
          {props.hasDraft && (
            <button
              type="button"
              className="link mt-3 block min-h-touch text-sm"
              disabled={discarding}
              onClick={() => startDiscard(async () => {
                await startOver(props.studentId);
                window.location.reload();
              })}
            >
              Start over
            </button>
          )}
          {ready && <MobileActionBar label={p.name ?? "New track"} action={props.creating ? "Creating…" : "Create track"} busy={props.creating} onClick={props.onCreate} />}
        </>
      )}
      </div>
    </aside>
  );
}


const SHOWN_TOPICS = 5;
function topicSummary(names: string[]) {
  if (names.length <= SHOWN_TOPICS + 1) return names.join(", ");
  return `${names.slice(0, SHOWN_TOPICS).join(", ")} and ${names.length - SHOWN_TOPICS} more (${names.length} in all)`;
}
