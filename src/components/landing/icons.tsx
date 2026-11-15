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

/** The GitHub mark (Octicons "mark-github"), used to link to the source code. */
export function GitHubIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
