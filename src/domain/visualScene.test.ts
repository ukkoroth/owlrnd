import { describe, expect, it } from "vitest";
import { sampleVisuals } from "@/content/visuals/samples";
import { checkScene, parseScene, polar, resolvePoint, type Scene } from "./visualScene";

const base = (): Scene => ({
  size: [400, 240],
  alt: "A ray and a mirror",
  points: { O: [200, 200], A: { from: "O", deg: 90, len: 100 } },
  steps: [{ caption: "A ray goes up.", add: [{ t: "seg", a: "O", b: "A", arrow: "mid" }] }],
});

const errorsOf = (s: unknown) => {
  const r = checkScene(s);
  return r.ok ? [] : r.errors;
};

describe("checkScene", () => {
  it("accepts all nine preview scenes", () => {
    for (const v of sampleVisuals) expect(errorsOf(v.scene), v.key).toEqual([]);
  });

  it("works out points from an angle and a length (0° right, 90° up)", () => {
    const [x, y] = polar([200, 200], 90, 100);
    expect(x).toBeCloseTo(200);
    expect(y).toBeCloseTo(100);
    expect(resolvePoint({ O: [10, 10], P: { from: "O", deg: 0, len: 5 } }, "P")).toEqual([15, 10]);
    expect(resolvePoint({ L: "L" }, "L")).toBeNull();
  });

  it("rejects unknown points and points outside the frame", () => {
    const s = base();
    s.steps[0]!.add.push({ t: "seg", a: "O", b: "Q" });
    s.steps[0]!.add.push({ t: "dot", at: { from: "O", deg: 0, len: 500 } });
    const errs = errorsOf(s);
    expect(errs.some((e) => e.includes('unknown point "Q"'))).toBe(true);
    expect(errs.some((e) => e.includes("outside the 400×240 frame"))).toBe(true);
  });

  it("keeps to the step, caption, label and shape limits", () => {
    const s = base();
    s.steps = Array.from({ length: 6 }, () => ({ caption: "x".repeat(141), add: [] }));
    s.base = Array.from({ length: 41 }, () => ({ t: "text" as const, at: [10, 10] as [number, number], s: "a label that is far too long to fit" }));
    const errs = errorsOf(s);
    expect(errs).toContain("use 1 to 5 steps");
    expect(errs.some((e) => e.includes("caption must be 1–140"))).toBe(true);
    expect(errs.some((e) => e.includes("labels must be 1–24"))).toBe(true);
    expect(errs.some((e) => e.includes("at most 40 shapes"))).toBe(true);
  });

  it("only moves or turns groups that were added earlier", () => {
    const s = base();
    s.steps[0]!.add.unshift({ t: "move", id: "fish", by: [0, -40] });
    s.steps.push({ caption: "Turn.", add: [{ t: "seg", id: "ray", a: "O", b: "A" }, { t: "rotate", id: "ray", deg: 90 }] });
    const errs = errorsOf(s);
    expect(errs.some((e) => e.includes('"fish" must be added before'))).toBe(true);
    expect(errs.some((e) => e.includes("only a group can be moved or turned"))).toBe(true);
  });

  it("allows only plain path commands and the fixed colours", () => {
    const s = base();
    s.steps[0]!.add.push({ t: "path", d: "M0 0 L10 10 <script>" });
    expect(errorsOf(s).some((e) => e.includes("d may use only"))).toBe(true);
    expect(errorsOf({ ...base(), steps: [{ caption: "x", add: [{ t: "seg", a: "O", b: "A", color: "#ff0000" }] }] }).length).toBeGreaterThan(0);
  });

  it("rejects unknown fields and bad JSON", () => {
    expect(errorsOf({ ...base(), script: "x" }).length).toBeGreaterThan(0);
    expect(parseScene("{nope")).toEqual({ ok: false, errors: ["the scene is not valid JSON"] });
    expect(parseScene(JSON.stringify(base())).ok).toBe(true);
  });
});
