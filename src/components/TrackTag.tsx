import { trackColor, trackTagLabel } from "@/domain/trackColors";

/** The track's coloured tag (owner, 2026-11-16): the chapter part of its name, in the track's own colour. */
export function TrackTag({ name, colorIndex }: { name: string; colorIndex: number }) {
  const c = trackColor(colorIndex);
  return (
    <span
      className="inline-flex max-w-full items-center truncate rounded px-2 py-0.5 text-[13px] font-semibold leading-5"
      style={{ background: c.fill, color: c.text }}
    >
      {trackTagLabel(name)}
    </span>
  );
}

/**
 * The card's left edge in the track's colour, filling from the bottom as the track nears its goal (owner,
 * 2026-11-16). Put it inside a card with `relative overflow-hidden`; the percentage is also given as text for
 * screen readers.
 */
export function TrackEdge({ colorIndex, completion }: { colorIndex: number; completion: number }) {
  const c = trackColor(colorIndex);
  const pct = Math.round(Math.max(0, Math.min(1, completion)) * 100);
  return (
    <>
      <span aria-hidden="true" className="absolute inset-y-0 left-0 flex w-1.5 flex-col justify-end" style={{ background: c.fill }}>
        <span className="block w-full transition-[height]" style={{ height: `${pct}%`, background: c.border }} />
      </span>
      <span className="sr-only">{pct}% of the way to the goal.</span>
    </>
  );
}
