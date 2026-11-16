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

/** The left border in the track's colour, for its cards. */
export const trackBorder = (colorIndex: number) => ({ borderLeftColor: trackColor(colorIndex).border, borderLeftWidth: 4 });
