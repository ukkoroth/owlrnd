/**
 * Rules §5, exam paper layout. Questions are measured at their normal size and placed page by page; a page never
 * scrolls, a question never splits, and text is never shrunk. Each page has `columns` columns that fill top to
 * bottom, left column first (owner decision, M4: "down, then across").
 */
export type Block = {
  /** Measured height of the question, in px, including any section heading above it (they move together). */
  height: number;
};

/** pages → columns → indexes of the blocks in that column. */
export type Pages = number[][][];

export function paginate(blocks: Block[], opts: { columnHeight: number; columns: number; gap: number }): Pages {
  const { columnHeight, columns, gap } = opts;
  const pages: Pages = [];
  let page: number[][] = [[]];
  let used = 0;

  const nextColumn = () => {
    if (page.length < columns) page.push([]);
    else {
      pages.push(page);
      page = [[]];
    }
    used = 0;
  };

  blocks.forEach((b, i) => {
    const own = b.height;
    const column = page[page.length - 1]!;
    if (column.length > 0 && used + gap + own > columnHeight) nextColumn();
    const target = page[page.length - 1]!;
    used += (target.length > 0 ? gap : 0) + own;
    target.push(i);
    // A question taller than a whole column gets the column to itself (it can't be split or shrunk).
    if (own > columnHeight) used = Number.POSITIVE_INFINITY;
  });

  if (page.some((c) => c.length > 0)) pages.push(page);
  return pages;
}

/** The page holding block `index` (to keep the student on the question they were on after a resize). */
export function pageOf(index: number, pages: Pages): number {
  const p = pages.findIndex((page) => page.some((col) => col.includes(index)));
  return p === -1 ? 0 : p;
}
