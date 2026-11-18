"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { pageOf, paginate, type Pages } from "@/domain/paging";

export const TWO_COLUMNS_FROM = 1024; // px of window width
export const COLUMN_GAP = 64;
export const QUESTION_GAP = 30;

const FULLSCREEN_CHANGE = ["fullscreenchange", "webkitfullscreenchange"] as const;

/** The height a column may use: the area minus its top and bottom padding. */
function roomIn(area: HTMLElement): number {
  const style = getComputedStyle(area);
  return area.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
}

/**
 * Rules §5 for any paper (the exam 4.1b and the marked paper 4.1f): every block is rendered once, out of sight, in
 * `measureRef` (each with `data-measure={index}`), at the real column width; the heights go to `paginate`, and one
 * page is shown in `areaRef`, which is exactly as tall as the space left in the window. Re-pages on resize and when
 * the serif font loads, staying on the page that holds the block the reader was last on.
 */
export function usePaging(count: number) {
  const [pages, setPages] = useState<Pages | null>(null);
  const [columns, setColumns] = useState(2);
  const [page, setPage] = useState(0);
  const areaRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const current = useRef(0);

  // Room held back after a shown column still ran past the bottom (safety net; normally 0). Reset on every resize.
  const slack = useRef(0);
  const retries = useRef(0);

  const layout = useCallback(() => {
    const area = areaRef.current;
    const measure = measureRef.current;
    if (!area || !measure) return;
    const cols = window.innerWidth >= TWO_COLUMNS_FROM ? 2 : 1;
    measure.style.width = `${cols === 2 ? (area.clientWidth - COLUMN_GAP) / 2 : area.clientWidth}px`;
    // A section heading sits inside its question's block, so the block's height already includes it.
    const blocks = Array.from({ length: count }, (_, i) => ({ height: measure.querySelector<HTMLElement>(`[data-measure="${i}"]`)?.offsetHeight ?? 0 }));
    const columnHeight = roomIn(area) - slack.current;
    const next = paginate(blocks, { columnHeight, columns: cols, gap: QUESTION_GAP });
    setColumns(cols);
    setPages(next);
    setPage(pageOf(current.current, next));
  }, [count]);

  useLayoutEffect(() => {
    layout();
    let t: ReturnType<typeof setTimeout>;
    const later = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        slack.current = 0;
        retries.current = 0;
        layout();
      }, 80);
    };
    // Watch the area itself, not just the window: entering or leaving full screen (animated on iPad), the browser's
    // bars and rotation change it, sometimes after the window's resize event has already fired.
    // The first report is the size just laid out for; only later changes page again.
    let lastSize: string | null = null;
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver((entries) => {
            const r = entries[0]?.contentRect;
            const size = r ? `${Math.round(r.width)}x${Math.round(r.height)}` : "";
            const first = lastSize === null;
            if (size === lastSize) return;
            lastSize = size;
            if (!first) later();
          });
    if (areaRef.current) observer?.observe(areaRef.current);
    window.addEventListener("resize", later);
    for (const ev of FULLSCREEN_CHANGE) document.addEventListener(ev, later);
    document.fonts?.ready.then(layout).catch(() => {});
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", later);
      for (const ev of FULLSCREEN_CHANGE) document.removeEventListener(ev, later);
      clearTimeout(t);
    };
  }, [layout]);

  // Safety net for rules §5: if a shown column still runs past the bottom (the measurement didn't match the real
  // render), hold back that much room and page again. A lone question taller than the page is left as it is.
  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area || !pages || retries.current >= 3) return;
    const room = roomIn(area);
    const cols = Array.from(area.querySelectorAll<HTMLElement>("[data-paper-column]")).filter((c) => c.childElementCount > 1);
    const over = Math.max(0, ...cols.map((c) => c.scrollHeight - room));
    if (over > 1) {
      retries.current++;
      slack.current += Math.ceil(over) + 8;
      layout();
    }
  }, [pages, page, layout]);

  return {
    areaRef,
    measureRef,
    pages,
    columns,
    page,
    /** Show page `p`, and keep its first question in view after a later re-layout (not the last one touched). */
    setPage: (p: number) => {
      const first = pages?.[p]?.[0]?.[0];
      if (first !== undefined) current.current = first;
      setPage(p);
    },
    pageCount: pages?.length ?? 1,
    /** Remember the block the reader is on (kept in view after a resize). */
    noteCurrent: (i: number) => {
      current.current = i;
    },
    /** Show the page holding block `i`. */
    goTo: (i: number) => {
      current.current = i;
      if (pages) setPage(pageOf(i, pages));
    },
  };
}

/** Section headings, only when a paper mixes both kinds of question (4.2b). Keyed by question index. */
export function sectionHeadings(types: ("multiple_choice" | "short")[]): Record<number, string> {
  const map: Record<number, string> = {};
  if (!(types.includes("multiple_choice") && types.includes("short"))) return map;
  let letter = 0;
  types.forEach((t, i) => {
    if (i === 0 || types[i - 1] !== t) map[i] = `Section ${"ABCD"[letter++]} · ${t === "multiple_choice" ? "Choose one answer" : "Write a word or one sentence"}`;
  });
  return map;
}
