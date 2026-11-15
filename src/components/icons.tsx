const base = {
  "aria-hidden": true,
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function StudentsIcon() {
  return (
    <svg {...base}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c2.2.7 3.5 2.4 3.5 5.2" />
    </svg>
  );
}

export function ExamsIcon() {
  return (
    <svg {...base}>
      <path d="M4 20V10M10 20V4M16 20v-7M2 20h20" />
    </svg>
  );
}

export function StarIcon() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
    </svg>
  );
}

export function ChevronUpIcon() {
  return (
    <svg {...base} width={16} height={16} strokeWidth={2.4}>
      <path d="M6 15l6-6 6 6" />
    </svg>
  );
}
