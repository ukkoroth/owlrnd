"use client";

import Link from "next/link";
import { ExamLink } from "@/components/exam/ExamLink";
import { useCallback, useEffect, useRef, useState } from "react";
import { answerCard, finishPractice } from "@/app/_actions/flashcards";
import { TrackTag } from "@/components/TrackTag";
import { SceneView } from "@/components/visuals/SceneView";
import type { SessionSummary, StartedSession } from "@/server/flashcards";

type Session = NonNullable<StartedSession>;

/**
 * A flashcard session (fc-2 front, fc-3 back, fc-4 summary). One card at a time, fitting the screen like the
 * exam paper (rules §5). Space shows the answer; 1 and 2 are "Not yet" and "Got it". Answers are saved as they are
 * given, so leaving part-way keeps them.
 */
export function FlashcardSession({ session, back }: { session: Session; back: string }) {
  const { cards } = session;
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const pending = useRef<Promise<unknown>[]>([]);
  const showRef = useRef<HTMLButtonElement>(null);
  const gotRef = useRef<HTMLButtonElement>(null);
  const card = cards[index];
  const done = !!summary;

  const finish = useCallback(async () => {
    await Promise.allSettled(pending.current);
    const s = await finishPractice(session.sessionId);
    if (s) setSummary(s);
    else setFailed(true);
  }, [session.sessionId]);

  const answer = useCallback(
    (result: "got_it" | "not_yet") => {
      if (!card || !flipped) return;
      pending.current.push(answerCard(session.sessionId, card.id, result).catch(() => setFailed(true)));
      if (index + 1 < cards.length) {
        setIndex(index + 1);
        setFlipped(false);
      } else void finish();
    },
    [card, flipped, index, cards.length, session.sessionId, finish],
  );

  // Keyboard: Space or Enter shows the answer; 1 = Not yet, 2 = Got it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done || e.metaKey || e.ctrlKey || e.altKey) return;
      const onButton = (e.target as HTMLElement | null)?.closest("button, a");
      if (!flipped && (e.key === " " || e.key === "Enter") && !onButton) {
        e.preventDefault();
        setFlipped(true);
      } else if (flipped && e.key === "1") answer("not_yet");
      else if (flipped && e.key === "2") answer("got_it");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipped, done, answer]);

  // Keep focus where the next action is.
  useEffect(() => {
    if (done) return;
    (flipped ? gotRef : showRef).current?.focus();
  }, [flipped, index, done]);

  const progress = Math.round(((summary ? cards.length : index) / cards.length) * 100);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line bg-card px-4 md:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <TrackTag name={session.trackName} colorIndex={session.colorIndex} />
          <span className="hidden font-semibold sm:inline">Flashcards</span>
        </div>
        <div className="flex items-center gap-3 text-sm font-semibold text-ink-muted">
          <span aria-live="polite">{done ? `${cards.length} of ${cards.length} done` : `Card ${index + 1} of ${cards.length}`}</span>
          <span aria-hidden="true" className="hidden h-2 w-24 overflow-hidden rounded-full bg-pale-2 sm:block md:w-56">
            <span className="block h-full bg-brand transition-[width]" style={{ width: `${progress}%` }} />
          </span>
        </div>
        <Link href={back} className="link flex min-h-touch items-center font-semibold">
          Leave
        </Link>
      </header>

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-4 py-6">
        {failed && (
          <p role="alert" className="mb-4 rounded border border-danger bg-danger-fill px-4 py-2 text-danger-text">
            Something went wrong saving your answers. Please leave and try again.
          </p>
        )}

        {summary ? (
          <Summary summary={summary} session={session} back={back} />
        ) : card ? (
          <>
            <section
              aria-label={flipped ? "Card, answer side" : "Card, question side"}
              className="flex max-h-full min-h-0 w-full max-w-[720px] flex-col rounded-md border border-line bg-card px-6 py-8 shadow-[0_10px_30px_rgba(19,44,107,0.08)] md:min-h-[380px] md:px-12 md:py-10"
            >
              <p className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-muted">
                <span>Topic · {card.topicName}</span>
                {card.fromMissed && !flipped && <span className="rounded bg-pale px-1.5 py-0.5 text-[11px] text-sidebar">From a missed exam question</span>}
              </p>
              {flipped ? (
                <div className="my-auto flex min-h-0 flex-col gap-3 overflow-y-auto py-4 text-center">
                  <p className="font-paper text-lg text-ink-muted md:text-[19px]">{card.front}</p>
                  <p className="font-paper text-2xl font-semibold md:text-[32px]">{card.answer}</p>
                  <p className="mx-auto max-w-[520px] text-[15px] leading-relaxed md:text-base">{card.explanation}</p>
                  {card.visual && <SceneView key={card.id} scene={card.visual} compact className="mt-1 text-left" />}
                </div>
              ) : (
                <p className="my-auto py-6 text-center font-paper text-2xl leading-snug md:text-[30px]">{card.front}</p>
              )}
            </section>

            {flipped ? (
              <div className="mt-6 grid w-full max-w-[720px] grid-cols-2 gap-4">
                <button type="button" onClick={() => answer("not_yet")} className="btn-outline h-14 text-lg">
                  Not yet
                </button>
                <button ref={gotRef} type="button" onClick={() => answer("got_it")} className="btn-primary h-14 text-lg">
                  Got it
                </button>
              </div>
            ) : (
              <button ref={showRef} type="button" onClick={() => setFlipped(true)} className="btn-primary mt-6 h-14 w-full max-w-[720px] text-lg">
                Show answer
              </button>
            )}
            <p className="mt-3 hidden text-[13px] text-ink-muted md:block">
              {flipped ? (
                <>
                  <Kbd>1</Kbd> Not yet · <Kbd>2</Kbd> Got it
                </>
              ) : (
                <>
                  <Kbd>Space</Kbd> shows the answer
                </>
              )}
            </p>
          </>
        ) : (
          <p className="text-ink-muted">Saving…</p>
        )}
      </main>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-b-2 border-line-input bg-card px-1.5 font-sans text-xs">{children}</kbd>;
}

const day = (d: Date) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(new Date(d));

/** fc-4: how it went, by topic; when cards come back; what next. Flashcards never change scores or goals. */
function Summary({ summary: s, session, back }: { summary: SessionSummary; session: Session; back: string }) {
  const from = back === "/tracks" ? "&from=tracks" : "";
  return (
    <section aria-labelledby="done-h" className="max-h-full w-full max-w-[720px] overflow-hidden rounded-md border border-line bg-card px-6 py-8 md:px-11 md:py-9">
      <h1 id="done-h" className="text-[28px] leading-tight">
        Session done
      </h1>
      <p className="mt-1 text-ink-muted">
        {session.trackName} · {s.cardsSeen} {s.cardsSeen === 1 ? "card" : "cards"} · about {s.minutes} {s.minutes === 1 ? "minute" : "minutes"}
      </p>
      <dl className={`my-6 grid gap-3 ${s.points ? "grid-cols-3" : "grid-cols-2"}`}>
        <div className="rounded bg-page px-4 py-4 text-center">
          <dt className="text-sm text-ink-muted">Got it</dt>
          <dd className="text-3xl font-bold">{s.gotIt}</dd>
        </div>
        <div className="rounded bg-page px-4 py-4 text-center">
          <dt className="text-sm text-ink-muted">To see again</dt>
          <dd className="text-3xl font-bold">{s.notYet}</dd>
        </div>
        {s.points > 0 && (
          <div className="rounded bg-page px-4 py-4 text-center">
            <dt className="text-sm text-ink-muted">Points</dt>
            <dd className="text-3xl font-bold text-brand">+{s.points}</dd>
          </div>
        )}
      </dl>
      {s.byTopic.length > 0 && (
        <ul className="divide-y divide-line border-y border-line">
          {s.byTopic.map((t) => (
            <li key={t.topicName} className="flex items-center justify-between gap-3 py-2.5 text-[15px]">
              <span>{t.topicName}</span>
              <span className={`rounded px-2 py-0.5 text-xs font-bold ${t.gotIt === t.seen ? "bg-[#E3F1E0] text-[#22531C]" : "bg-[#FDF2E3] text-[#7A4508]"}`}>
                {t.gotIt} of {t.seen} got it
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-sm text-ink-muted">
        {s.notYet > 0 ? `The ${s.notYet} you're still learning come back tomorrow. ` : "Nice. "}
        {s.next ? `Next: ${s.next.count} ${s.next.count === 1 ? "card" : "cards"} due on ${day(s.next.at)}.` : ""}
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {s.notYet > 0 && (
          <Link href={`/practise/${session.trackId}?again=${session.sessionId}${from}`} className="btn-outline h-12">
            Practise these {s.notYet} again
          </Link>
        )}
        {s.readyExam && (
          <ExamLink href={`/exam/${s.readyExam.id}`} className="btn-primary h-12">
            Start exam {s.readyExam.number}
          </ExamLink>
        )}
        <Link href={back} className="btn-outline h-12">
          {back === "/tracks" ? "Back to your tracks" : "Back to Exams"}
        </Link>
      </div>
    </section>
  );
}
