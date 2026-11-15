"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createTrack, sendTurn, startOver } from "@/app/(parent)/students/[id]/tracks/actions";
import { rules } from "@/config/rules";
import { canCreateTrack, formatTestDate, goalLabel, type StoredPreview } from "@/domain/tracks";
import type { ChatMessage } from "@/server/tracks";
import { ChatThread, PanelRows } from "./chat/ChatThread";

type Props = {
  studentId: string;
  studentName: string;
  parentFirstName: string;
  isFirst: boolean;
  initialMessages: ChatMessage[];
  initialPreview: StoredPreview;
};

const STARTERS = [
  ["A chapter for an upcoming unit test", "Unit test on <date>. Subject: <subject>. Chapter: <chapter and its topics>."],
  ["Revision for the half-yearly exams", "Half-yearly exams start on <date>. Subject: <subject>. Revise: <chapters>."],
  ["Practice from textbook pages I will attach", "Subject: <subject>. Practice from the attached textbook pages."],
] as const;

/** The track chat (2e start, 2f agreed): messages on the left, the track preview on the right. */
export function TrackChat({ studentId, studentName, parentFirstName, isFirst: isFirstProp, initialMessages, initialPreview }: Props) {
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

  const ready = preview.ready && canCreateTrack(preview);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
      <ChatThread
        greeting={
          <>
            <p className="font-semibold">
              Hi {parentFirstName}. Let&apos;s create {isFirst ? `${studentName}'s first track` : `a new track for ${studentName}`}.
            </p>
            <p className="mt-2">
              Tell me what {studentName} is studying: the subject, the chapter, and any test coming up with its date. If you have them, attach photos of the
              textbook pages or the syllabus. I will find the topics and suggest a goal for the track.
            </p>
          </>
        }
        starters={STARTERS}
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
        studentName={studentName}
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
  studentName: string;
  hasDraft: boolean;
  onCreate: () => void;
}) {
  const { preview: p, ready, created } = props;
  const [discarding, startDiscard] = useTransition();
  const rows: [string, string | null][] = [
    ["Name", p.name],
    ["Topics found", p.topics.length ? p.topics.map((t) => t.name).join(", ") : null],
    ["Each exam", `Up to ${rules.exam.maxQuestions} questions, multiple choice and short answers`],
    ["Test date", p.testDate ? formatTestDate(p.testDate) : null],
    ["Goal", p.goal ? `${goalLabel(p.goal)}. The track stops when it is reached.` : null],
  ];
  return (
    <aside aria-label="New track preview" className="card sticky top-6 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-bold uppercase tracking-wider">New track</h2>
        <span className={`rounded px-2 py-1 text-xs font-bold ${ready || created ? "bg-brand text-white" : "bg-pale text-ink-muted"}`}>
          {ready || created ? "Ready" : "Draft"}
        </span>
      </div>
      {!props.hasDraft && <p className="mb-2 text-sm text-ink-muted">Fills in as you chat.</p>}
      <PanelRows rows={rows} />
      {created ? (
        <Link href={`/students/${props.studentId}/tracks?created=1`} className="btn-primary mt-4 w-full">
          Open {props.studentName}&apos;s tracks
        </Link>
      ) : (
        <>
          <button type="button" className="btn-primary mt-4 w-full" disabled={!ready || props.creating} onClick={props.onCreate}>
            {props.creating ? "Creating…" : "Create track"}
          </button>
          {!ready && props.hasDraft && <p className="mt-2 text-[13px] text-ink-muted">Agree the name, topics and goal in the chat to create the track.</p>}
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
        </>
      )}
    </aside>
  );
}

