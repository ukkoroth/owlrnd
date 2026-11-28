"use client";

import { useMemo } from "react";
import type { MarkedQuestion } from "@/server/results";
import { SceneView } from "@/components/visuals/SceneView";
import { COLUMN_GAP, QUESTION_GAP, sectionHeadings, usePaging } from "./usePaging";

type Props = {
  paper: { id: string; number: number; score: number; trackName: string; questions: MarkedQuestion[] };
  /** Defaults are for the student; the parent's view (from exam history) links back there. */
  backHref?: string;
  backLabel?: string;
  doneHref?: string;
  doneLabel?: string;
};

/**
 * 4.1f. Every question with a tick or cross, the correct option filled, the student's wrong option ringed red,
 * and a one-line reason for each miss. A miss with a picture shows it under the reason, playing when its page comes
 * up (docs/plan-wrong-answer-visuals.md). Paged like the exam, picture included, so it never scrolls either (rules §5).
 */
export function MarkedPaper({ paper, backHref, backLabel = "Back to result", doneHref = "/today", doneLabel = "Back to dashboard" }: Props) {
  const qs = paper.questions;
  const { areaRef, measureRef, pages, columns, page, setPage, pageCount } = usePaging(qs.length);
  const headings = useMemo(() => sectionHeadings(qs.map((q) => q.type)), [qs]);
  const isLast = page >= pageCount - 1;

  const render = (i: number, measure: boolean) => <Marked key={i} index={i} q={qs[i]!} heading={headings[i]} measure={measure} />;

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex h-[60px] shrink-0 items-center justify-between gap-3 border-b border-paper-rule px-4 font-sans md:px-10">
        <h1 className="truncate text-[17px] font-semibold">
          {paper.trackName}
          <span className="ml-3 font-normal text-paper-muted">Marked paper · {paper.score} / 10</span>
        </h1>
        <a href={backHref ?? `/exam/${paper.id}/result`} className="flex min-h-touch shrink-0 items-center gap-2 whitespace-nowrap text-[15px] hover:underline">
          <span aria-hidden="true">←</span> {backLabel}
        </a>
      </header>

      <main className="relative mx-4 flex min-h-0 flex-1 flex-col md:mx-[58px]">
        <div ref={areaRef} className="relative min-h-0 flex-1 overflow-hidden pt-6" style={{ paddingBottom: 12 }}>
          {pages && (
            <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, columnGap: COLUMN_GAP }} role="group" aria-label={`Page ${page + 1} of ${pageCount}`}>
              {(pages[page] ?? []).map((col, c) => (
                <div key={c} data-paper-column className="flex min-h-0 flex-col" style={{ gap: QUESTION_GAP }}>
                  {col.map((i) => render(i, false))}
                </div>
              ))}
            </div>
          )}
        </div>
        <div ref={measureRef} aria-hidden="true" inert className="pointer-events-none invisible absolute left-0 top-0 -z-10">
          {qs.map((_, i) => render(i, true))}
        </div>

        <footer className="flex h-[84px] shrink-0 items-center justify-between gap-3 border-t border-paper-ink/80 font-sans">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[15px]">
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="h-4 w-4 rounded-full bg-paper-select" /> Correct answer
            </span>
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="h-4 w-4 rounded-full border-2 border-paper-wrong" /> Your wrong answer
            </span>
            {pageCount > 1 && <span className="font-semibold">Page {page + 1} of {pageCount}</span>}
          </div>
          <div className="flex items-center gap-3">
            {page > 0 && (
              <button type="button" aria-label="Previous page" className="btn whitespace-nowrap border border-paper-ink bg-white px-4 text-paper-ink hover:bg-black/5" onClick={() => setPage(page - 1)}>
                ← <span className="hidden md:inline">Previous</span>
              </button>
            )}
            {!isLast ? (
              <button type="button" aria-label="Next page" className="btn whitespace-nowrap border border-paper-ink bg-white px-4 text-paper-ink hover:bg-black/5" onClick={() => setPage(page + 1)}>
                <span className="hidden md:inline">Next</span> →
              </button>
            ) : (
              <a href={doneHref} className="btn whitespace-nowrap bg-paper-select px-6 text-white hover:opacity-90">
                {doneLabel}
              </a>
            )}
          </div>
        </footer>
      </main>
    </div>
  );
}

function Marked({ index, q, heading, measure }: { index: number; q: MarkedQuestion; heading?: string; measure: boolean }) {
  return (
    <div data-measure={measure ? index : undefined} data-question={measure ? undefined : index} className="font-paper">
      {heading && <h2 className="mb-3 text-[15px] font-bold uppercase tracking-wide">{heading}</h2>}
      <div className="flex gap-3 text-[17px] leading-snug">
        <span className={`w-5 shrink-0 font-sans text-lg font-bold ${q.correct ? "text-paper-select" : "text-paper-wrong"}`} aria-hidden="true">
          {q.correct ? "✓" : "✗"}
        </span>
        <span className="w-7 shrink-0 font-semibold">{index + 1}.</span>
        <p>
          <span className="sr-only">{q.correct ? "Correct. " : "Wrong. "}</span>
          {q.prompt}
        </p>
      </div>

      <div className="mt-3 pl-[72px]">
        {q.type === "multiple_choice" ? (
          <ul className="flex flex-wrap gap-x-7 gap-y-3">
            {q.options.map((opt, o) => {
              const isCorrect = o === q.correctOption;
              const wrongPick = !q.correct && o === q.chosenOption;
              return (
                <li key={o} className={`flex items-center gap-2.5 text-[17px] ${isCorrect ? "font-bold" : wrongPick ? "font-bold text-paper-wrong" : ""}`}>
                  <span
                    aria-hidden="true"
                    className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border font-sans text-[12px] font-semibold ${
                      isCorrect ? "border-paper-select bg-paper-select text-white" : wrongPick ? "border-2 border-paper-wrong bg-danger-fill text-paper-wrong" : "border-paper-circle"
                    }`}
                  >
                    {"ABCD"[o]}
                  </span>
                  <span className="sr-only">{isCorrect ? "Correct answer: " : wrongPick ? "Your answer: " : ""}</span>
                  {opt}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="text-[17px]">
            <p className="text-paper-muted">
              Your answer: <span className={`font-bold ${q.correct ? "text-paper-select" : "text-paper-wrong"}`}>{q.text?.trim() || "(blank)"}</span>
            </p>
            {!q.correct && (
              <p className="mt-1 text-paper-muted">
                Answer: <span className="font-bold text-paper-select">{q.expectedAnswer}</span>
              </p>
            )}
          </div>
        )}
        {!q.correct && (
          <p className="mt-2.5 text-[16px]">
            <strong>Why:</strong> {q.reason ? `${q.reason} ` : ""}
            {q.explanation}
          </p>
        )}
        {!q.correct && q.visual && <SceneView scene={q.visual} still={measure} className="mt-3" />}
      </div>
    </div>
  );
}
