/** Stroke icons from the landing hand-off (2px stroke, round caps). All decorative. */

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" />
      <path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
    </svg>
  );
}

export function CapIcon({ size = 24, tassel = true, className }: { size?: number; tassel?: boolean; className?: string }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M2 9l10-5 10 5-10 5z" />
      <path d="M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" />
      {tassel && <path d="M22 9v6" />}
    </svg>
  );
}

export function PeopleIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" className={className} {...stroke}>
      <circle cx="9" cy="7" r="3.5" />
      <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
      <path d="M16 4.5a3 3 0 0 1 0 5.6M18 14.3c2 .8 3.5 2.6 3.5 5.7" />
    </svg>
  );
}

export function StarIcon() {
  return (
    <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8z" />
    </svg>
  );
}

/** Hand-drawn amber underline under "every day." in the hero. */
export function Swash() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 300 20"
      preserveAspectRatio="none"
      className="absolute bottom-[-0.16em] left-0 h-[0.22em] w-full overflow-visible"
    >
      <path d="M4 14 C 70 4, 150 4, 296 10" fill="none" stroke="#FFC94D" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}
