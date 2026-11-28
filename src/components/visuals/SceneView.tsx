"use client";

import { useEffect, useRef, useState } from "react";
import type { Scene } from "@/domain/visualScene";
import { SceneEngine } from "./sceneEngine";

type Props = {
  scene: Scene;
  /** Plays each time this turns true (the question's page is shown, the card is turned over). */
  active?: boolean;
  /** The hidden copy the paper measures for paging: the finished picture, never animated. */
  still?: boolean;
  /** Smaller picture, for a flashcard's answer side. */
  compact?: boolean;
  className?: string;
};

/**
 * A picture for a question or card (docs/plan-wrong-answer-visuals.md): the drawing, its steps as a real list (read
 * by screen readers), and Replay. Same height whether playing or finished, so paging measures it correctly.
 * With reduced motion the finished picture shows at once.
 */
export function SceneView({ scene, active = true, still = false, compact = false, className = "" }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const engine = useRef<SceneEngine | null>(null);
  const [step, setStep] = useState(scene.steps.length);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!svgRef.current) return;
    const e = new SceneEngine(svgRef.current, scene, (s, p) => {
      setStep(s);
      setPlaying(p);
    });
    engine.current = e;
    e.showAll();
    return () => e.stop();
  }, [scene]);

  useEffect(() => {
    if (still || !engine.current) return;
    if (active) void engine.current.play();
    else engine.current.showAll();
  }, [active, still, scene]);

  const [w, h] = scene.size;
  return (
    <figure className={`grid items-start gap-x-4 gap-y-2 font-sans md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] ${className}`}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={scene.alt}
        className={`block h-auto ${compact ? "max-h-[min(200px,24dvh)]" : "max-h-[min(240px,32dvh)]"} w-full border border-[#E6E3DA] bg-white font-sans md:row-span-2`}
      />
      <ol className="list-decimal pl-5 text-[13.5px] leading-snug text-paper-ink" aria-live="off">
        {scene.steps.map((s, i) => (
          <li key={i} className={`my-0.5 transition-opacity ${i <= step ? "" : "opacity-60"} ${playing && i === step ? "text-paper-select" : ""}`}>
            {s.caption}
          </li>
        ))}
      </ol>
      <div>
        <button
          type="button"
          tabIndex={still ? -1 : undefined}
          onClick={() => void engine.current?.play()}
          className="flex min-h-touch items-center gap-2 rounded border border-paper-select bg-white px-3.5 text-sm font-semibold text-paper-select hover:bg-pale-2"
        >
          <span aria-hidden="true">↻</span> Replay
        </button>
      </div>
    </figure>
  );
}
