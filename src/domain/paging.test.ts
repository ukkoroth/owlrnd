import { describe, expect, it } from "vitest";
import { pageOf, paginate } from "./paging";

const opts = { columnHeight: 100, columns: 2, gap: 10 };
const h = (...heights: number[]) => heights.map((height) => ({ height }));

describe("paginate (rules §5)", () => {
  it("fits everything on one page when it can, down the left column first", () => {
    expect(paginate(h(40, 40, 40, 40), opts)).toEqual([[[0, 1], [2, 3]]]);
  });

  it("spills to a second page, keeping order and never splitting a question", () => {
    const pages = paginate(h(60, 60, 60, 60, 60), opts);
    expect(pages).toEqual([[[0], [1]], [[2], [3]], [[4]]]);
    expect(pages.flat(2)).toEqual([0, 1, 2, 3, 4]); // continuous numbering
  });

  it("counts the gap between questions", () => {
    expect(paginate(h(45, 45), { ...opts, columns: 1 })).toEqual([[[0, 1]]]); // 45 + 10 + 45 = 100
    expect(paginate(h(46, 45), { ...opts, columns: 1 })).toEqual([[[0]], [[1]]]);
  });

  it("gives a question taller than a column a column to itself", () => {
    expect(paginate(h(30, 150, 30), opts)).toEqual([[[0], [1]], [[2]]]);
  });

  it("uses one column in narrow mode", () => {
    expect(paginate(h(40, 40, 40), { ...opts, columns: 1 })).toEqual([[[0, 1]], [[2]]]);
  });

  it("handles an empty paper", () => {
    expect(paginate([], opts)).toEqual([]);
  });
});

describe("pageOf", () => {
  it("finds the page holding a question", () => {
    const pages = paginate(h(60, 60, 60, 60, 60), opts);
    expect(pageOf(0, pages)).toBe(0);
    expect(pageOf(3, pages)).toBe(1);
    expect(pageOf(4, pages)).toBe(2);
    expect(pageOf(99, pages)).toBe(0);
  });
});
