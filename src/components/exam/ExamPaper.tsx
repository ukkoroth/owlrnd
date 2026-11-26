"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { saveAnswer, submitExam } from "@/app/(paper)/exam/[id]/actions";
import { blankQuestions, blankSentence, type AnswerValue } from "@/domain/exam";
import { blockMessage, isRealAnswer, submitBlock, type RushGuard, type SubmitBlock } from "@/domain/rushGuard";
import type { Paper, PaperQuestion } from "@/server/exams";
import { COLUMN_GAP, QUESTION_GAP, sectionHeadings, usePaging } from "./usePaging";
import { enterFullscreen, exitFullscreen, FULLSCREEN_EVENTS, fullscreenSupported, isFullscreen } from "./fullscreen";

const TEXT_SAVE_DELAY = 600;

type Answers = Record<string, AnswerValue>;
type SaveState = "idle" | "saving" | "saved" | "error";

// ── Local copy (0.2: the answer sheet survives the Back button) ─────────────
// Every change is also kept in sessionStorage for this tab, with its time. Reads and writes are wrapped, so the
// paper works when storage is blocked (private windows, previews).
type LocalCopy = Record<string, { v: AnswerValue; at: number }>;
const storageKey = (examId: string) => `owlrnd:exam:${examId}`;

function readLocal(examId: string): LocalCopy {
  try {
    return JSON.parse(window.sessionStorage.getItem(storageKey(examId)) ?? "{}") as LocalCopy;
  } catch {
    return {};
  }
}

function writeLocal(examId: string, questionId: string, v: AnswerValue) {
  try {
    const copy = readLocal(examId);
    copy[questionId] = { v, at: Date.now() };
    window.sessionStorage.setItem(storageKey(examId), JSON.stringify(copy));
  } catch {}
}

function clearLocal(examId: string) {
  try {
    window.sessionStorage.removeItem(storageKey(examId));
  } catch {}
}

/**
 * The exam paper (4.1b, 4.2b). Rules §5: the page never scrolls. Every question is rendered once, out of sight, at
 * the real column width; the heights go to `paginate`, and one page at a time is shown in a container that is exactly
 * the window's height. Resizing pages the questions again, keeping answers and the question the student was on.
 */
export function ExamPaper({ paper, rushGuard }: { paper: Paper; rushGuard: RushGuard | null }) {
  const qs = paper.questions;
  const [answers, setAnswers] = useState<Answers>(() =>
    Object.fromEntries(qs.map((q) => [q.id, paper.answers[q.id] ?? { chosenOption: null, text: null }])),
  );
  const { areaRef, measureRef, pages, columns, page, setPage, pageCount, noteCurrent, goTo } = usePaging(qs.length);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [blanks, setBlanks] = useState<number[]>([]);
  const [submitting, startSubmit] = useTransition();
  const [focusTarget, setFocusTarget] = useState<number | null>(null);

  const dialogRef = useRef<HTMLDialogElement>(null);
  // Rules §5a: a paper that is empty, keyboard mash or handed in within seconds can't be submitted yet.
  const [block, setBlock] = useState<SubmitBlock | null>(null);
  const blockRef = useRef<HTMLDialogElement>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const inflight = useRef(new Set<Promise<unknown>>());

  // Full screen: the Start link asks for it; the top bar lets the learner leave it (or Esc) and go back in. Entering
  // or leaving resizes the window, so the questions are paged again, keeping answers and the current question.
  const [canFullscreen, setCanFullscreen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    setCanFullscreen(fullscreenSupported());
    const onChange = () => setFullscreen(isFullscreen());
    onChange();
    for (const ev of FULLSCREEN_EVENTS) document.addEventListener(ev, onChange);
    return () => {
      for (const ev of FULLSCREEN_EVENTS) document.removeEventListener(ev, onChange);
    };
  }, []);

  const headings = useMemo(() => sectionHeadings(qs.map((q) => q.type)), [qs]);

  // Move focus to a question after "Go to question N".
  useEffect(() => {
    if (focusTarget === null || !pages) return;
    const el = document.querySelector<HTMLElement>(`[data-question="${focusTarget}"] input:not([type=radio]), [data-question="${focusTarget}"] input:checked, [data-question="${focusTarget}"] input`);
    el?.focus();
    setFocusTarget(null);
  }, [focusTarget, pages, page]);

  // ── Saving ───────────────────────────────────────────────────────────────
  const persist = useCallback(
    (questionId: string, value: AnswerValue, attempt = 1) => {
      setSaveState("saving");
      const p = saveAnswer(paper.id, questionId, value)
        .then((ok) => {
          if (!ok) throw new Error("not saved");
          setSaveState("saved");
        })
        .catch(() => {
          if (attempt < 3) setTimeout(() => persist(questionId, value, attempt + 1), 1500 * attempt);
          else setSaveState("error");
        })
        .finally(() => inflight.current.delete(p));
      inflight.current.add(p);
    },
    [paper.id],
  );

  const flush = useCallback(async () => {
    for (const [id, t] of timers.current) {
      clearTimeout(t);
      timers.current.delete(id);
      persist(id, answersRef.current[id]!);
    }
    await Promise.allSettled([...inflight.current]);
  }, [persist]);

  const answersRef = useRef(answers);
  answersRef.current = answers;

  // On opening: an answer kept in this tab that is newer than the server's copy (typed just before Back, say)
  // wins, and is saved now.
  useEffect(() => {
    const local = readLocal(paper.id);
    const newer = Object.entries(local).filter(([id, { at }]) => qs.some((q) => q.id === id) && at > (paper.answerSavedAt[id] ?? 0));
    if (!newer.length) return;
    setAnswers((a) => ({ ...a, ...Object.fromEntries(newer.map(([id, { v }]) => [id, v])) }));
    for (const [id, { v }] of newer) persist(id, v);
    // Only on first render: later changes are saved as they happen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Leaving the paper (Back, another tab, closing it): send every answer still waiting for its pause at once.
  // sendBeacon is delivered even as the page goes away.
  const sendPending = useCallback(() => {
    if (!timers.current.size) return;
    const pending: Answers = {};
    for (const [id, t] of timers.current) {
      clearTimeout(t);
      pending[id] = answersRef.current[id]!;
    }
    timers.current.clear();
    const body = new Blob([JSON.stringify({ answers: pending })], { type: "application/json" });
    if (!navigator.sendBeacon?.(`/api/exam/${paper.id}/answers`, body)) {
      for (const [id, v] of Object.entries(pending)) persist(id, v);
    }
  }, [paper.id, persist]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") sendPending();
    };
    // Restored from the back-forward cache: show the answers as saved now, not as they were.
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
    };
    window.addEventListener("pagehide", sendPending);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pageshow", onShow);
    return () => {
      window.removeEventListener("pagehide", sendPending);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pageshow", onShow);
      sendPending(); // client-side navigation away (Back) unmounts the paper without a pagehide
    };
  }, [sendPending]);

  const choose = (q: PaperQuestion, option: number) => {
    const value = { chosenOption: option, text: null };
    setAnswers((a) => ({ ...a, [q.id]: value }));
    writeLocal(paper.id, q.id, value);
    persist(q.id, value);
  };

  const type = (q: PaperQuestion, text: string) => {
    const value = { chosenOption: null, text };
    setAnswers((a) => ({ ...a, [q.id]: value }));
    writeLocal(paper.id, q.id, value);
    clearTimeout(timers.current.get(q.id));
    timers.current.set(
      q.id,
      setTimeout(() => {
        timers.current.delete(q.id);
        persist(q.id, value);
      }, TEXT_SAVE_DELAY),
    );
  };

  const blurText = (q: PaperQuestion) => {
    const t = timers.current.get(q.id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(q.id);
      persist(q.id, answersRef.current[q.id]!);
    }
  };

  // Warn before closing the tab only while something is still being saved.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (timers.current.size || inflight.current.size) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // ── Submit (4.1c) ────────────────────────────────────────────────────────
  const doSubmit = () =>
    startSubmit(async () => {
      await flush();
      clearLocal(paper.id);
      exitFullscreen();
      // The server checks again (rules §5a); it only refuses here if the browser's clock is off.
      const refused = await submitExam(paper.id);
      if (refused) showBlock(refused);
    });

  // The first question still to answer (blank or random typing), for the "Answer at least N" dialog.
  const firstToAnswer = useMemo(() => {
    const i = qs.findIndex((q) => !isRealAnswer(q, answers[q.id]));
    return i < 0 ? null : i + 1;
  }, [qs, answers]);

  const showBlock = (b: SubmitBlock) => {
    dialogRef.current?.close();
    setBlock(b);
    blockRef.current?.showModal();
  };

  const onSubmit = async () => {
    await flush();
    const refused = submitBlock(qs, answersRef.current, paper.startedAt ? new Date(paper.startedAt) : null, new Date(), rushGuard);
    if (refused) return showBlock(refused);
    const missing = blankQuestions(qs, answersRef.current);
    if (missing.length) {
      setBlanks(missing);
      dialogRef.current?.showModal();
    } else doSubmit();
  };

  const goToQuestion = (n: number) => {
    dialogRef.current?.close();
    goTo(n - 1);
    setFocusTarget(n - 1);
  };

  const leave = async () => {
    exitFullscreen(); // straight away, while this still counts as part of the click
    await flush();
    // A full load, not router.push: the client router cache would otherwise show a stale dashboard ("Start"
    // instead of "Continue").
    window.location.assign("/today");
  };

  const isLast = page >= pageCount - 1;

  const renderQuestion = (i: number, measure: boolean) => (
    <Question
      key={i}
      index={i}
      q={qs[i]!}
      value={answers[qs[i]!.id]!}
      heading={headings[i]}
      measure={measure}
      onChoose={choose}
      onType={type}
      onBlurText={blurText}
      onFocus={() => noteCurrent(i)}
    />
  );

  return (
    // In full screen the paper runs to the very edge of the screen, so it gets room above and below (owner,
    // 2026-11-18); the safe-area insets keep it clear of rounded corners and the home bar.
    <div
      className="flex h-dvh flex-col overflow-hidden"
      style={fullscreen ? { paddingTop: "max(28px, env(safe-area-inset-top))", paddingBottom: "max(24px, env(safe-area-inset-bottom))" } : undefined}
    >
      <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-paper-rule px-4 font-sans md:px-10">
        <h1 className="truncate text-[17px] font-semibold">
          {paper.trackName}
          <span className="sr-only">, exam {paper.number}</span>
        </h1>
        <div className="flex shrink-0 items-center gap-5 pl-3">
          <span className="hidden text-sm text-paper-muted sm:block" role="status" aria-live="polite">
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Couldn't save. Check your connection." : ""}
          </span>
          {canFullscreen && (
            <button
              type="button"
              onClick={fullscreen ? exitFullscreen : enterFullscreen}
              className="flex min-h-touch min-w-touch shrink-0 items-center justify-center gap-2 whitespace-nowrap text-[15px] hover:underline"
            >
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                {fullscreen ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
              </svg>
              <span className="hidden sm:inline">{fullscreen ? "Exit full screen" : "Full screen"}</span>
              <span className="sr-only sm:hidden">{fullscreen ? "Exit full screen" : "Full screen"}</span>
            </button>
          )}
          <button type="button" onClick={leave} className="flex min-h-touch shrink-0 items-center gap-2 whitespace-nowrap text-[15px] hover:underline">
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M5 5l14 14M19 5L5 19" />
            </svg>
            Leave exam
          </button>
        </div>
      </header>

      <main className="relative mx-4 flex min-h-0 flex-1 flex-col md:mx-[58px]">
        <div ref={areaRef} className="relative min-h-0 flex-1 overflow-hidden pt-6" style={{ paddingBottom: 12 }}>
          {pages && (
            <div
              className="grid h-full"
              style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, columnGap: COLUMN_GAP }}
              aria-label={`Page ${page + 1} of ${pageCount}`}
              role="group"
            >
              {(pages[page] ?? []).map((col, c) => (
                <div key={c} data-paper-column className="flex min-h-0 flex-col" style={{ gap: QUESTION_GAP }}>
                  {col.map((i) => renderQuestion(i, false))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Measuring layer: same markup, out of sight and out of the accessibility tree. */}
        <div ref={measureRef} aria-hidden="true" inert className="pointer-events-none invisible absolute left-0 top-0 -z-10">
          {qs.map((_, i) => renderQuestion(i, true))}
        </div>

        <footer className="flex h-[84px] shrink-0 items-center justify-between gap-4 border-t border-paper-ink/80 font-sans">
          <p className="whitespace-nowrap text-[16px] font-semibold" aria-live="polite">
            Page {page + 1} of {pageCount}
          </p>
          <div className="flex items-center gap-3">
            {page > 0 && (
              <button
                type="button"
                aria-label="Previous page"
                className="btn whitespace-nowrap border border-paper-ink bg-white px-4 text-paper-ink hover:bg-black/5 md:px-5"
                onClick={() => setPage(page - 1)}
              >
                ← <span className="hidden md:inline">Previous page</span>
                <span className="md:hidden">Previous</span>
              </button>
            )}
            {!isLast && (
              <button
                type="button"
                aria-label="Next page"
                className="btn whitespace-nowrap border border-paper-ink bg-white px-4 text-paper-ink hover:bg-black/5 md:px-5"
                onClick={() => setPage(page + 1)}
              >
                <span className="hidden md:inline">Next page</span>
                <span className="md:hidden">Next</span> →
              </button>
            )}
            {isLast && (
              <button
                type="button"
                className="btn h-12 whitespace-nowrap bg-paper-select px-6 text-[16px] text-white hover:opacity-90 disabled:opacity-60 md:w-[240px] md:px-10"
                onClick={onSubmit}
                disabled={submitting}
              >
                {submitting ? "Submitting…" : "Submit exam"}
              </button>
            )}
          </div>
        </footer>
      </main>

      <dialog
        ref={dialogRef}
        aria-labelledby="blank-title"
        className="m-auto w-[min(480px,calc(100vw-32px))] rounded bg-white p-7 font-sans text-paper-ink backdrop:bg-black/45"
      >
        <h2 id="blank-title" className="text-[22px] font-semibold">
          {blanks.length === 1 ? "1 question is not answered" : `${blanks.length} questions are not answered`}
        </h2>
        <p className="mt-3 text-paper-muted">{blanks.length > 0 && `${blankSentence(blanks)} Unanswered questions count as wrong.`}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" className="btn border border-paper-ink bg-white px-5" onClick={() => goToQuestion(blanks[0]!)} autoFocus>
            Go to question {blanks[0]}
          </button>
          <button
            type="button"
            className="btn bg-paper-select px-5 text-white hover:opacity-90"
            onClick={() => {
              dialogRef.current?.close();
              doSubmit();
            }}
          >
            Submit anyway
          </button>
        </div>
      </dialog>

      <dialog
        ref={blockRef}
        aria-labelledby="block-title"
        className="m-auto w-[min(480px,calc(100vw-32px))] rounded bg-white p-7 font-sans text-paper-ink backdrop:bg-black/45"
      >
        {block && (
          <>
            <h2 id="block-title" className="text-[22px] font-semibold">
              {blockMessage(block).title}
            </h2>
            <p className="mt-3 text-paper-muted">{blockMessage(block).body}</p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              {block.reason === "too_few" && firstToAnswer !== null ? (
                <button
                  type="button"
                  className="btn bg-paper-select px-5 text-white hover:opacity-90"
                  onClick={() => {
                    blockRef.current?.close();
                    goToQuestion(firstToAnswer);
                  }}
                  autoFocus
                >
                  Go to question {firstToAnswer}
                </button>
              ) : (
                <button type="button" className="btn bg-paper-select px-5 text-white hover:opacity-90" onClick={() => blockRef.current?.close()} autoFocus>
                  Back to my answers
                </button>
              )}
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}

function Question(props: {
  index: number;
  q: PaperQuestion;
  value: AnswerValue;
  heading?: string;
  measure: boolean;
  onChoose: (q: PaperQuestion, option: number) => void;
  onType: (q: PaperQuestion, text: string) => void;
  onBlurText: (q: PaperQuestion) => void;
  onFocus: () => void;
}) {
  const { index, q, value, heading, measure } = props;
  const n = index + 1;
  const id = `${measure ? "m" : "q"}-${q.id}`;
  const promptId = `${id}-prompt`;

  return (
    <div data-measure={measure ? index : undefined} data-question={measure ? undefined : index} onFocus={props.onFocus} className="font-paper">
      {heading && (
        <h2 className="mb-3 text-[15px] font-bold uppercase tracking-wide">
          {heading}
        </h2>
      )}
      {q.type === "multiple_choice" ? (
        <fieldset>
          <legend className="flex w-full gap-3 text-[17px] leading-snug">
            <span className="w-7 shrink-0 font-semibold">{n}.</span>
            <span>{q.prompt}</span>
          </legend>
          <div className="mt-3 flex flex-wrap gap-x-7 gap-y-3 pl-10">
            {q.options.map((opt, o) => {
              const checked = value.chosenOption === o;
              return (
                <label key={o} className="group flex min-h-[32px] cursor-pointer items-center gap-2.5 text-[17px]">
                  <input
                    type="radio"
                    name={id}
                    className="peer sr-only"
                    checked={checked}
                    onChange={() => props.onChoose(q, o)}
                    tabIndex={measure ? -1 : undefined}
                  />
                  <span
                    aria-hidden="true"
                    className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border font-sans text-[12px] font-semibold peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-paper-select group-hover:border-paper-select ${
                      checked ? "border-paper-select bg-paper-select text-white" : "border-paper-circle text-paper-ink"
                    }`}
                  >
                    {"ABCD"[o]}
                  </span>
                  <span className="sr-only">Option {"ABCD"[o]}: </span>
                  {opt}
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <div>
          <p id={promptId} className="flex gap-3 text-[17px] leading-snug">
            <span className="w-7 shrink-0 font-semibold">{n}.</span>
            <span>{q.prompt}</span>
          </p>
          <div className="mt-3 pl-10">
            <input
              type="text"
              aria-labelledby={promptId}
              value={value.text ?? ""}
              maxLength={300}
              autoComplete="off"
              spellCheck
              placeholder="One word or one short sentence"
              onChange={(e) => props.onType(q, e.target.value)}
              onBlur={() => props.onBlurText(q)}
              tabIndex={measure ? -1 : undefined}
              className="h-11 w-full max-w-[420px] rounded border border-paper-circle bg-white px-3 font-paper text-[17px] text-paper-ink placeholder:text-paper-muted focus:border-paper-select focus:outline focus:outline-1 focus:outline-paper-select"
            />
          </div>
        </div>
      )}
    </div>
  );
}
