"use client";

import { useEffect, useState } from "react";
import { examStatus } from "../actions";

const POLL_MS = 2000;

function Step({ state, children }: { state: "done" | "active" | "todo"; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 text-[16px]">
      {state === "done" ? (
        <span aria-hidden="true" className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-paper-select text-white">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
      ) : state === "active" ? (
        <span aria-hidden="true" className="h-[26px] w-[26px] animate-spin rounded-full border-[3px] border-[#A9BCE0] border-t-paper-select" />
      ) : (
        <span aria-hidden="true" className="h-[26px] w-[26px] rounded-full border-2 border-paper-rule" />
      )}
      <span className={state === "todo" ? "text-paper-muted" : ""}>
        {children}
        <span className="sr-only">{state === "done" ? " (done)" : state === "active" ? " (in progress)" : ""}</span>
      </span>
    </li>
  );
}

/** Polls until the exam is marked, then opens the result (4.1e). */
export function MarkingProgress({ examId, mcq, short }: { examId: string; mcq: number; short: number }) {
  const [done, setDone] = useState(false);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        if ((await examStatus(examId)) === "marked") {
          setDone(true);
          window.location.assign(`/exam/${examId}/result`);
          return;
        }
      } catch {}
      if (!stop) setTimeout(tick, POLL_MS);
    };
    const t = setTimeout(tick, 600);
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [examId]);

  return (
    <>
      <ol className="mt-6 flex flex-col gap-4" aria-live="polite">
        <Step state="done">
          Multiple-choice answers marked: {mcq} of {mcq}
        </Step>
        {short > 0 && (
          <Step state={done ? "done" : "active"}>
            {done ? `Written answers marked: ${short} of ${short}` : `Reading your ${short} written ${short === 1 ? "answer" : "answers"}…`}
          </Step>
        )}
        <Step state={done ? "done" : short > 0 ? "todo" : "active"}>Your result and next exam</Step>
      </ol>
      <a href={`/exam/${examId}/result`} className="btn mt-7 w-fit border border-paper-ink bg-white px-5 text-paper-ink hover:bg-black/5">
        See result when ready
      </a>
    </>
  );
}
