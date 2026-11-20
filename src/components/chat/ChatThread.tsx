"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { rules } from "@/config/rules";
import { resizeImage } from "@/lib/resizeImage";
import type { ChatMessage } from "@/server/tracks";
import { FormError } from "../forms";

type Props = {
  greeting: ReactNode;
  messages: ChatMessage[];
  /** Sends one turn. Resolves to an error message, or null when the parent's messages were updated. */
  onSend: (form: FormData) => Promise<string | null>;
  placeholder: string;
  starters?: readonly (readonly [string, string])[];
  /** Hide the message box (after the track is created or updated). */
  closed?: boolean;
  error?: string | null;
};

/**
 * The chat with the owlrnd AI, shared by track creation (2e/2f) and track updates (2j, Add material): greeting,
 * starters, the conversation, "owlrnd AI is reading…", and a message box with Attach file and Take photo.
 * Photos are resized in the browser before upload; a failed turn keeps the parent's text and files.
 */
export function ChatThread({ greeting, messages, onSend, placeholder, starters, closed, error: outerError }: Props) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingTurn, setPendingTurn] = useState<{ text: string; labels: string[] } | null>(null);
  const [sending, startSending] = useTransition();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, pendingTurn]);

  const addFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setError(null);
    const resized = await Promise.all(Array.from(list).map((f) => resizeImage(f, rules.chat.imageMaxEdgePx)));
    setFiles((prev) => [...prev, ...resized].slice(0, rules.chat.maxFilesPerMessage));
  };

  const send = () => {
    if (sending || (!text.trim() && !files.length)) return;
    const fd = new FormData();
    fd.set("message", text);
    files.forEach((f) => fd.append("files", f));
    setPendingTurn({ text: text.trim(), labels: files.map((f) => f.name) });
    setError(null);
    startSending(async () => {
      try {
        const err = await onSend(fd);
        if (err) setError(err);
        else {
          setText("");
          setFiles([]);
        }
      } catch {
        setError("I couldn't answer just now. Send it again?");
      }
      setPendingTurn(null);
    });
  };

  return (
    <section aria-label="Chat with the owlrnd AI" className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-col gap-5" aria-live="polite">
        <AiMessage>{greeting}</AiMessage>

        {starters && messages.length === 0 && !pendingTurn && (
          <div>
            <p className="mb-2 text-sm text-ink-muted">Or start with one of these</p>
            <div className="flex flex-wrap gap-2">
              {starters.map(([label, template]) => (
                <button
                  key={label}
                  type="button"
                  className="btn-outline min-h-touch px-4 text-sm"
                  onClick={() => {
                    setText(template);
                    textRef.current?.focus();
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) =>
          // The account holder's own messages (a parent's, or a learner's on their own track).
          m.author !== "ai" ? (
            <ParentMessage key={m.id} text={m.text} labels={m.attachments.map((a) => (a.unreadable ? `${a.label} (unreadable)` : a.label))} />
          ) : (
            <AiMessage key={m.id}>
              <p className="whitespace-pre-line">{m.text}</p>
            </AiMessage>
          ),
        )}

        {pendingTurn && (
          <>
            <ParentMessage text={pendingTurn.text} labels={pendingTurn.labels} />
            <AiMessage>
              <p className="animate-pulse text-ink-muted">owlrnd AI is reading…</p>
            </AiMessage>
          </>
        )}
        <div ref={endRef} />
      </div>

      <FormError>{error ?? outerError}</FormError>

      {!closed && (
        <form
          className="rounded border border-ink bg-card p-4"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <label htmlFor="chat-message" className="sr-only">
            Message
          </label>
          <textarea
            id="chat-message"
            ref={textRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={2}
            maxLength={4000}
            placeholder={placeholder}
            className="w-full resize-y rounded bg-page/60 px-4 py-3 text-[16px] placeholder:text-ink-muted focus:outline-none"
          />
          {/* While a turn is being read, its files show in the pending message above, not here,
              and no more can be added; they come back only if the turn fails. */}
          {files.length > 0 && !sending && (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Files to send">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center gap-1 rounded border border-line bg-pale-2 py-1 pl-3 pr-1 text-sm">
                  {f.name}
                  <button type="button" className="min-h-[32px] min-w-[32px] rounded text-ink-muted hover:text-ink" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {!sending && (
              <>
                <FileButton label="Attach file" accept="image/*,application/pdf" onFiles={addFiles} icon={<PaperclipIcon />} />
                <FileButton label="Take photo" accept="image/*" capture onFiles={addFiles} icon={<CameraIcon />} />
              </>
            )}
            <button type="submit" className="btn-primary ml-auto px-8" disabled={sending || (!text.trim() && !files.length)}>
              Send
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function AiMessage({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-[500px]">
      <p className="mb-1 text-sm font-semibold text-brand">owlrnd AI</p>
      <div className="text-[16px] leading-relaxed">{children}</div>
    </div>
  );
}

function ParentMessage({ text, labels }: { text: string; labels: string[] }) {
  return (
    <div className="ml-auto w-full max-w-[540px]">
      <p className="mb-1 text-right text-sm font-semibold text-ink-muted">You</p>
      <div className="rounded border border-line-input bg-card px-4 py-3">
        {text && <p className="whitespace-pre-line text-[16px]">{text}</p>}
        {labels.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Attached">
            {labels.map((l, i) => (
              <li key={i} className="flex h-[78px] w-[60px] items-end rounded border border-line bg-pale-2 p-1.5 text-xs leading-tight text-ink-muted">
                {l}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FileButton({ label, accept, capture, onFiles, icon }: { label: string; accept: string; capture?: boolean; onFiles: (f: FileList | null) => void; icon: ReactNode }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={!capture}
        capture={capture ? "environment" : undefined}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        data-testid={capture ? "take-photo-input" : "attach-file-input"}
        onChange={(e) => {
          void onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <button type="button" className="btn-outline h-11 px-4 text-[15px]" onClick={() => ref.current?.click()}>
        {icon}
        {label}
      </button>
    </>
  );
}

function PaperclipIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5l-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l9-9a3.7 3.7 0 0 1 5.2 5.2l-9 9a1.8 1.8 0 0 1-2.6-2.6l8.3-8.3" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

/** The side panel's rows (New track / Track update). */
/** The preview card's rows. Rows named in `needed` are still missing and show "Still needed" in red. */
export function PanelRows({ rows, needed = [] }: { rows: [string, string | null][]; needed?: string[] }) {
  return (
    <dl className="divide-y divide-line border-b border-line">
      {rows.map(([label, value]) => {
        const missing = needed.includes(label);
        return (
          <div key={label} className={`py-2.5 ${missing ? "-mx-2 rounded bg-danger-fill px-2" : ""}`}>
            <dt className={`text-[13px] ${missing ? "font-semibold text-danger-text" : "text-ink-muted"}`}>{label}</dt>
            <dd className={`font-semibold ${missing ? "text-danger-text" : value ? "" : "text-ink-muted/60"}`}>{missing ? (value ? `${value} (check this)` : "Still needed") : (value ?? "—")}</dd>
          </div>
        );
      })}
    </dl>
  );
}

/**
 * The side card's frame (2e/2f preview, track update): on wide screens it sticks beside the chat and never grows past
 * the window; its details scroll inside it while the title and the main button stay in view.
 */
export const SIDE_CARD = "card flex flex-col p-5 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)]";
export const SIDE_CARD_BODY = "min-h-0 flex-1 overflow-y-auto overscroll-contain lg:-mr-2 lg:pr-2";
/** The card's footer (its main button): pinned to the window's bottom edge while the card runs past it. */
export const SIDE_CARD_FOOT = "shrink-0 bg-card lg:sticky lg:bottom-0 lg:-mb-5 lg:pb-5";

/**
 * Below the wide layout the card sits under the chat, so the main action also gets a bar fixed to the bottom of the
 * screen once it can be used (owner, 2026-11-16: the button shouldn't need scrolling to find).
 */
export function MobileActionBar({ label, action, busy, onClick }: { label: string; action: string; busy?: boolean; onClick: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-3 border-t border-line bg-card px-4 pt-3 shadow-[0_-6px_20px_rgba(19,44,107,0.08)] lg:hidden" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
      <p className="min-w-0 flex-1 truncate text-sm font-semibold">{label}</p>
      <button type="button" className="btn-primary h-12 shrink-0 px-5" disabled={busy} onClick={onClick}>
        {action}
      </button>
    </div>
  );
}
