import { polar, resolvePoint, type Scene, type SceneColor, type SceneItem, type ScenePoint } from "@/domain/visualScene";

/**
 * Draws a checked scene (domain/visualScene.ts) into an <svg> and plays its steps. Plain DOM, so the animation runs
 * without re-rendering React. Colours are the marked paper's (tailwind `paper.*`): navy for the right idea, red for
 * the slip.
 */

const NS = "http://www.w3.org/2000/svg";
const COLORS: Record<SceneColor, string> = {
  ink: "#111111",
  right: "#172F73",
  wrong: "#B3261E",
  muted: "#8A8880",
  glass: "#DCE9FF",
  water: "#E3ECFB",
  sticker: "#FFC94D",
  pale: "#BBD2FB",
};
const STROKE_COLORS = ["ink", "right", "wrong", "muted"] as const;
const col = (c: SceneColor | undefined) => COLORS[c ?? "ink"];
const PAUSE_AFTER_STEP = 1100;

type Attrs = Record<string, string | number | null | undefined>;
function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs, parent?: Element): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, String(v));
  parent?.appendChild(e);
  return e;
}

export const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export class SceneEngine {
  private run = 0;
  private nodes = new Map<string, SVGGraphicsElement>();
  private under: SVGGElement;
  private main: SVGGElement;
  private target: SVGGElement;
  private readonly prefix: string;

  constructor(
    private readonly svg: SVGSVGElement,
    private readonly scene: Scene,
    private readonly onStep: (step: number, playing: boolean) => void,
  ) {
    svg.replaceChildren();
    this.prefix = `sc${Math.random().toString(36).slice(2, 8)}`;
    const defs = el("defs", {}, svg);
    for (const c of STROKE_COLORS) {
      const m = el("marker", { id: `${this.prefix}-${c}`, viewBox: "0 0 10 10", refX: 6, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
      el("path", { d: "M0 0 L10 5 L0 10 Z", fill: COLORS[c] }, m);
    }
    this.under = el("g", {}, svg);
    this.main = el("g", {}, svg);
    this.target = this.main;
  }

  private p(v: ScenePoint): [number, number] {
    return resolvePoint(this.scene.points, v) ?? [0, 0];
  }

  private reset() {
    this.under.replaceChildren();
    this.main.replaceChildren();
    this.nodes.clear();
    for (const it of this.scene.base ?? []) this.add(it, false);
  }

  /** The finished picture, with no animation (reduced motion, the hidden copy used for paging, or before playing). */
  showAll() {
    this.run++;
    this.reset();
    for (const s of this.scene.steps) for (const it of s.add) this.add(it, false);
    this.onStep(this.scene.steps.length, false);
  }

  stop() {
    this.run++;
  }

  async play() {
    if (prefersReducedMotion()) return this.showAll();
    const run = ++this.run;
    this.reset();
    for (const [i, step] of this.scene.steps.entries()) {
      if (run !== this.run) return;
      this.onStep(i, true);
      for (const it of step.add) {
        if (run !== this.run) return;
        await sleep(this.add(it, true));
      }
      await sleep(PAUSE_AFTER_STEP);
    }
    if (run === this.run) this.onStep(this.scene.steps.length, false);
  }

  /** Adds one item; returns how long to wait before the next (ms). */
  private add(it: SceneItem, animate: boolean): number {
    const layer = "under" in it && it.under ? this.under : this.target;
    let node: SVGGraphicsElement | null = null;
    let draw = false;
    let wait = 350;
    let arrows: (() => void) | null = null;

    switch (it.t) {
      case "seg": {
        const a = this.p(it.a);
        const b = this.p(it.b);
        const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const path = el("path", { d: `M${a} L${m} L${b}`, stroke: col(it.color), "stroke-width": it.w ?? 2, fill: "none", "stroke-dasharray": it.dash ? "6 5" : null, "stroke-linecap": "round" }, layer);
        if (it.arrow) {
          const ref = `url(#${this.prefix}-${STROKE_COLORS.includes(it.color as never) ? it.color : "ink"})`;
          arrows = () => {
            if (it.arrow === "mid") path.setAttribute("marker-mid", ref);
            if (it.arrow === "end" || it.arrow === "both") path.setAttribute("marker-end", ref);
            if (it.arrow === "both") path.setAttribute("marker-start", ref);
          };
        }
        node = path;
        draw = !it.dash;
        wait = 650;
        break;
      }
      case "path":
        node = el("path", { d: it.d, stroke: it.fill && !it.color ? "none" : col(it.color), "stroke-width": it.w ?? 2, fill: it.fill ? col(it.fill) : "none", "stroke-dasharray": it.dash ? "6 5" : null }, layer);
        draw = !it.fill && !it.dash;
        wait = 600;
        break;
      case "poly":
        node = el("polygon", { points: it.pts.map((q) => this.p(q).join(",")).join(" "), fill: it.fill ? col(it.fill) : "none", "fill-opacity": it.fo ?? 1, stroke: it.stroke ? col(it.stroke) : "none", "stroke-width": it.w ?? 1.5, "stroke-dasharray": it.dash ? "5 4" : null }, layer);
        wait = 450;
        break;
      case "rect":
        node = el("rect", { x: it.x, y: it.y, width: it.w, height: it.h, fill: col(it.fill), stroke: it.stroke ? col(it.stroke) : "none" }, layer);
        wait = 300;
        break;
      case "hatch": {
        const a = this.p(it.a);
        const b = this.p(it.b);
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L] as const;
        const side = it.side ?? 1;
        const n = [-u[1] * side, u[0] * side] as const;
        let d = "";
        for (let s = 8; s < L; s += 13) {
          const q = [a[0] + u[0] * s, a[1] + u[1] * s];
          d += `M${q} L${q[0]! + n[0] * 9 - u[0] * 6},${q[1]! + n[1] * 9 - u[1] * 6}`;
        }
        node = el("path", { d, stroke: COLORS.muted, "stroke-width": 1.2 }, layer);
        break;
      }
      case "angle": {
        const o = this.p(it.at);
        const r = it.r ?? 40;
        const [f, t] = it.to < it.from ? [it.to, it.from] : [it.from, it.to];
        const s = polar(o, f, r);
        const e = polar(o, t, r);
        const g = el("g", {}, layer);
        el("path", { d: `M${s} A${r} ${r} 0 ${t - f > 180 ? 1 : 0} 0 ${e}`, stroke: col(it.color), "stroke-width": 2, fill: "none" }, g);
        if (it.label) label(g, polar(o, it.la ?? (f + t) / 2, it.lr ?? r + 17), it.label, col(it.color), { size: 13.5, bold: true, dy: 4.5 });
        node = g;
        wait = 500;
        break;
      }
      case "dot": {
        const o = this.p(it.at);
        const g = el("g", {}, layer);
        el("circle", { cx: o[0], cy: o[1], r: 3.5, fill: col(it.color) }, g);
        if (it.label) label(g, [o[0] + (it.dx ?? 0), o[1] + (it.dy ?? -9)], it.label, col(it.color), { size: 14, bold: true, halo: false });
        node = g;
        wait = 300;
        break;
      }
      case "text":
        node = label(layer, this.p(it.at), it.s, col(it.color), { size: it.size ?? 13, bold: it.bold, anchor: it.anchor });
        wait = 300;
        break;
      case "dim": {
        const a = this.p(it.a);
        const b = this.p(it.b);
        const g = el("g", {}, layer);
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const n = [(-(b[1] - a[1]) / L) * 6, ((b[0] - a[0]) / L) * 6];
        const c = col(it.color);
        el("path", { d: `M${a} L${b} M${a[0] - n[0]!},${a[1] - n[1]!} L${a[0] + n[0]!},${a[1] + n[1]!} M${b[0] - n[0]!},${b[1] - n[1]!} L${b[0] + n[0]!},${b[1] + n[1]!}`, stroke: c, "stroke-width": 1.5 }, g);
        label(g, [(a[0] + b[0]) / 2 + (it.lx ?? 0), (a[1] + b[1]) / 2 + (it.ly ?? -7)], it.label, c, { size: 13, bold: true, anchor: it.anchor });
        node = g;
        wait = 450;
        break;
      }
      case "group": {
        const o = it.at ? this.p(it.at) : [0, 0];
        const outer = el("g", { transform: `translate(${o})`, opacity: it.opacity ?? 1 }, layer);
        const inner = el("g", {}, outer);
        inner.style.transformBox = "view-box";
        if (it.about) inner.style.transformOrigin = `${it.about[0]}px ${it.about[1]}px`;
        this.nodes.set(`${it.id}.inner`, inner);
        const saved = this.target;
        this.target = inner;
        for (const sub of it.items) this.add(sub, false);
        this.target = saved;
        node = outer;
        wait = 400;
        break;
      }
      case "move":
      case "rotate": {
        const inner = this.nodes.get(`${it.id}.inner`);
        if (!inner) return 0;
        const dur = it.dur ?? 1200;
        const transform = it.t === "move" ? `translate(${it.by[0]}px, ${it.by[1]}px)` : `rotate(${it.deg}deg)`;
        inner.style.transition = animate ? `transform ${dur}ms cubic-bezier(.45,0,.25,1)` : "none";
        if (animate) requestAnimationFrame(() => requestAnimationFrame(() => (inner.style.transform = transform)));
        else inner.style.transform = transform;
        return animate ? dur + 150 : 0;
      }
      case "fade": {
        const n = this.nodes.get(it.id);
        if (!n) return 0;
        n.style.transition = animate ? "opacity .5s" : "none";
        n.style.opacity = String(it.to);
        return animate ? 400 : 0;
      }
    }
    if (!node) return 0;
    if (it.id) this.nodes.set(it.id, node);
    if (!animate) {
      arrows?.();
      return 0;
    }
    if (draw && node instanceof SVGGeometryElement) {
      const geo = node;
      const len = geo.getTotalLength();
      geo.style.strokeDasharray = `${len}`;
      geo.style.strokeDashoffset = `${len}`;
      geo.getBoundingClientRect();
      geo.style.transition = "stroke-dashoffset .7s ease-out";
      requestAnimationFrame(() => (geo.style.strokeDashoffset = "0"));
      setTimeout(() => {
        geo.style.strokeDasharray = "";
        arrows?.();
      }, 720);
    } else {
      const target = node.getAttribute("opacity") ?? "1";
      const shown = node;
      shown.style.opacity = "0";
      shown.getBoundingClientRect();
      shown.style.transition = "opacity .5s";
      requestAnimationFrame(() => (shown.style.opacity = target));
      arrows?.();
    }
    return wait;
  }
}

function label(parent: Element, at: [number, number], text: string, fill: string, o: { size: number; bold?: boolean; anchor?: string; dy?: number; halo?: boolean }) {
  const t = el("text", { x: at[0], y: at[1] + (o.dy ?? 0), "text-anchor": o.anchor ?? "middle", fill, "font-size": o.size, "font-weight": o.bold ? 700 : 500, ...(o.halo === false ? {} : { "paint-order": "stroke", stroke: "#fff", "stroke-width": 4 }) }, parent);
  t.textContent = text;
  return t;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
