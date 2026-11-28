import { z } from "zod";
import { rules } from "@/config/rules";

/**
 * Pictures for questions and cards (docs/plan-wrong-answer-visuals.md). The AI describes a picture as a small scene;
 * the app checks it here and draws it (components/visuals). Rays are given by angle and length, and angle arcs in
 * degrees, so the geometry comes out right without the AI placing every coordinate.
 *
 * Coordinates are SVG user units: x to the right, y downwards. Degrees are counted anticlockwise from "east"
 * (0° = right, 90° = up), as in a maths textbook.
 */

export const SCENE_COLORS = ["ink", "right", "wrong", "muted", "glass", "water", "sticker", "pale"] as const;
export type SceneColor = (typeof SCENE_COLORS)[number];

export type ScenePoint = [number, number] | string | { from: ScenePoint; deg: number; len: number };

const num = z.number().finite();
const xy = z.tuple([num, num]);
const point: z.ZodType<ScenePoint> = z.lazy(() => z.union([xy, z.string(), z.object({ from: point, deg: num, len: num }).strict()]));
const color = z.enum(SCENE_COLORS);
const id = z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,15}$/, "ids are letters, digits and _, starting with a letter");

const seg = z.object({ t: z.literal("seg"), id: id.optional(), a: point, b: point, color: color.optional(), w: num.optional(), dash: z.boolean().optional(), arrow: z.enum(["mid", "end", "both"]).optional() }).strict();
const path = z.object({ t: z.literal("path"), id: id.optional(), d: z.string(), color: color.optional(), fill: color.optional(), w: num.optional(), dash: z.boolean().optional() }).strict();
const poly = z.object({ t: z.literal("poly"), id: id.optional(), pts: z.array(point), fill: color.optional(), fo: num.optional(), stroke: color.optional(), w: num.optional(), dash: z.boolean().optional(), under: z.boolean().optional() }).strict();
const rect = z.object({ t: z.literal("rect"), id: id.optional(), x: num, y: num, w: num, h: num, fill: color, stroke: color.optional() }).strict();
const hatch = z.object({ t: z.literal("hatch"), id: id.optional(), a: point, b: point, side: z.union([z.literal(1), z.literal(-1)]).optional() }).strict();
const angle = z.object({ t: z.literal("angle"), id: id.optional(), at: point, from: num, to: num, r: num.optional(), lr: num.optional(), la: num.optional(), label: z.string().optional(), color: color.optional() }).strict();
const dot = z.object({ t: z.literal("dot"), id: id.optional(), at: point, label: z.string().optional(), dx: num.optional(), dy: num.optional(), color: color.optional() }).strict();
const text = z.object({ t: z.literal("text"), id: id.optional(), at: point, s: z.string(), color: color.optional(), size: num.optional(), anchor: z.enum(["start", "middle", "end"]).optional(), bold: z.boolean().optional() }).strict();
const dim = z.object({ t: z.literal("dim"), id: id.optional(), a: point, b: point, label: z.string(), color: color.optional(), lx: num.optional(), ly: num.optional(), anchor: z.enum(["start", "middle", "end"]).optional() }).strict();

const shape = z.discriminatedUnion("t", [seg, path, poly, rect, hatch, angle, dot, text, dim]);
const group = z.object({ t: z.literal("group"), id, at: point.optional(), about: xy.optional(), opacity: num.optional(), items: z.array(shape) }).strict();
const move = z.object({ t: z.literal("move"), id, by: xy, dur: num.optional() }).strict();
const rotate = z.object({ t: z.literal("rotate"), id, deg: num, dur: num.optional() }).strict();
const fade = z.object({ t: z.literal("fade"), id, to: num }).strict();
const item = z.discriminatedUnion("t", [seg, path, poly, rect, hatch, angle, dot, text, dim, group, move, rotate, fade]);

export const sceneSchema = z
  .object({
    size: xy,
    alt: z.string(),
    points: z.record(z.string(), point).optional(),
    base: z.array(item).optional(),
    steps: z.array(z.object({ caption: z.string(), add: z.array(item) }).strict()),
  })
  .strict();

export type Scene = z.infer<typeof sceneSchema>;
export type SceneItem = z.infer<typeof item>;
export type SceneShape = z.infer<typeof shape>;

const rad = (d: number) => (d * Math.PI) / 180;
export const polar = (o: [number, number], deg: number, len: number): [number, number] => [o[0] + len * Math.cos(rad(deg)), o[1] - len * Math.sin(rad(deg))];

/** A point's coordinates; named points come from `scene.points`. Null when a name is unknown or refers to itself. */
export function resolvePoint(points: Scene["points"], p: ScenePoint, seen: string[] = []): [number, number] | null {
  if (Array.isArray(p)) return p;
  if (typeof p === "string") {
    const target = points?.[p];
    if (target === undefined || seen.includes(p)) return null;
    return resolvePoint(points, target, [...seen, p]);
  }
  const o = resolvePoint(points, p.from, seen);
  return o ? polar(o, p.deg, p.len) : null;
}

export type SceneCheck = { ok: true; scene: Scene } | { ok: false; errors: string[] };

const PATH_D = /^[MLHVQCAZmlhvqcaz0-9.,\s-]+$/;

/**
 * Everything a scene must keep to before it is stored or drawn (docs/07-ai.md §8). The problems are worded for the
 * AI, which gets one retry with them listed.
 */
export function checkScene(raw: unknown): SceneCheck {
  const parsed = sceneSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.slice(0, 6).map((i) => `${i.path.join(".") || "scene"}: ${i.message}`) };
  const scene = parsed.data;
  const V = rules.visuals;
  const errors: string[] = [];
  const [w, h] = scene.size;
  if (w < 200 || w > 600 || h < 100 || h > 420) errors.push("size must be 200–600 wide and 100–420 tall");
  if (!scene.alt.trim() || scene.alt.length > 200) errors.push("alt must describe the picture in at most 200 characters");
  if (scene.steps.length < 1 || scene.steps.length > V.maxSteps) errors.push(`use 1 to ${V.maxSteps} steps`);
  for (const [i, s] of scene.steps.entries()) {
    if (!s.caption.trim() || s.caption.length > V.maxCaption) errors.push(`step ${i + 1}: the caption must be 1–${V.maxCaption} characters`);
  }
  for (const name of Object.keys(scene.points ?? {})) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,11}$/.test(name)) errors.push(`point name "${name}" must be letters and digits, at most 12`);
  }

  const inFrame = (p: [number, number]) => p[0] >= -10 && p[0] <= w + 10 && p[1] >= -10 && p[1] <= h + 10;
  const checkPoint = (where: string, p: ScenePoint) => {
    const at = resolvePoint(scene.points, p);
    if (!at) errors.push(`${where}: unknown point ${JSON.stringify(p)}`);
    else if (!inFrame(at)) errors.push(`${where}: point (${Math.round(at[0])}, ${Math.round(at[1])}) is outside the ${w}×${h} frame`);
  };
  const checkLabel = (where: string, s: string | undefined) => {
    if (s !== undefined && (!s.trim() || s.length > V.maxLabel)) errors.push(`${where}: labels must be 1–${V.maxLabel} characters`);
  };

  const ids = new Map<string, "group" | "shape">();
  let count = 0;
  const visitShape = (where: string, it: SceneShape, offset: [number, number] = [0, 0]) => {
    count++;
    const pt = (label: string, p: ScenePoint) => (offset[0] || offset[1] ? undefined : checkPoint(`${where} ${label}`, p));
    switch (it.t) {
      case "seg": case "hatch": case "dim": pt("a", it.a); pt("b", it.b); break;
      case "angle": pt("at", it.at); if (it.r !== undefined && (it.r < 5 || it.r > 200)) errors.push(`${where}: r must be 5–200`); break;
      case "dot": case "text": pt("at", it.at); break;
      case "poly": if (it.pts.length < 3 || it.pts.length > 12) errors.push(`${where}: a poly has 3–12 points`); it.pts.forEach((p, k) => pt(`point ${k + 1}`, p)); break;
      case "rect": if (!inFrame([it.x, it.y]) || !inFrame([it.x + it.w, it.y + it.h]) || it.w <= 0 || it.h <= 0) errors.push(`${where}: the rectangle must lie inside the frame`); break;
      case "path": if (!PATH_D.test(it.d) || it.d.length > 600) errors.push(`${where}: d may use only M L H V Q C A Z and numbers (at most 600 characters)`); break;
    }
    if ("label" in it) checkLabel(where, it.label);
    if (it.t === "text") checkLabel(where, it.s);
    if ("w" in it && it.t !== "rect" && it.w !== undefined && (it.w < 0.5 || it.w > 5)) errors.push(`${where}: line width must be 0.5–5`);
    if (it.t === "text" && it.size !== undefined && (it.size < 10 || it.size > 22)) errors.push(`${where}: text size must be 10–22`);
    if (it.id) {
      if (ids.has(it.id)) errors.push(`${where}: id "${it.id}" is used twice`);
      ids.set(it.id, "shape");
    }
  };
  const visit = (where: string, it: SceneItem) => {
    if (it.t === "group") {
      if (ids.has(it.id)) errors.push(`${where}: id "${it.id}" is used twice`);
      ids.set(it.id, "group");
      if (it.at) checkPoint(`${where} at`, it.at);
      if (!it.items.length) errors.push(`${where}: a group needs items`);
      it.items.forEach((sub, k) => visitShape(`${where} item ${k + 1}`, sub, it.at ? [1, 1] : [0, 0]));
      return;
    }
    if (it.t === "move" || it.t === "rotate" || it.t === "fade") {
      const target = ids.get(it.id);
      if (!target) errors.push(`${where}: "${it.id}" must be added before it is moved, turned or faded`);
      else if (it.t !== "fade" && target !== "group") errors.push(`${where}: only a group can be moved or turned`);
      if ("dur" in it && it.dur !== undefined && (it.dur < 200 || it.dur > 3000)) errors.push(`${where}: dur must be 200–3000 ms`);
      if (it.t === "fade" && (it.to < 0 || it.to > 1)) errors.push(`${where}: fade "to" must be 0–1`);
      return;
    }
    visitShape(where, it);
  };
  (scene.base ?? []).forEach((it, k) => visit(`base item ${k + 1}`, it));
  scene.steps.forEach((s, i) => s.add.forEach((it, k) => visit(`step ${i + 1} item ${k + 1}`, it)));
  if (count > V.maxItems) errors.unshift(`at most ${V.maxItems} shapes in a scene (this one has ${count})`);

  return errors.length ? { ok: false, errors: [...new Set(errors)].slice(0, 10) } : { ok: true, scene };
}

/** A scene written as JSON text by the AI. */
export function parseScene(json: string): SceneCheck {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, errors: ["the scene is not valid JSON"] };
  }
  return checkScene(raw);
}
