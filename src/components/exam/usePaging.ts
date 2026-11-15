"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { pageOf, paginate, type Pages } from "@/domain/paging";

export const TWO_COLUMNS_FROM = 1024; // px of window width
export const COLUMN_GAP = 64;
export const QUESTION_GAP = 30;

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

  const layout = useCallback(() => {
    const area = areaRef.current;
    const measure = measureRef.current;
    if (!area || !measure) return;
    const cols = window.innerWidth >= TWO_COLUMNS_FROM ? 2 : 1;
    measure.style.width = `${cols === 2 ? (area.clientWidth - COLUMN_GAP) / 2 : area.clientWidth}px`;
    // A section heading sits inside its question's block, so the block's height already includes it.
    const blocks = Array.from({ length: count }, (_, i) => ({ height: measure.querySelector<HTMLElement>(`[data-measure="${i}"]`)?.offsetHeight ?? 0 }));
    const style = getComputedStyle(area);
    const columnHeight = area.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const next = paginate(blocks, { columnHeight, columns: cols, gap: QUESTION_GAP });
    setColumns(cols);
    setPages(next);
    setPage(pageOf(current.current, next));
  }, [count]);

  useLayoutEffect(() => {
    layout();
    let t: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(layout, 80);
    };
    window.addEventListener("resize", onResize);
    document.fonts?.ready.then(layout).catch(() => {});
    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(t);
    };
  }, [layout]);

  return {
    areaRef,
    measureRef,
    pages,
    columns,
    page,
    setPage,
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
