import type { ReactNode } from "react";

/** Page title with an optional subtitle and action, underlined like the mockups (2k, 5b, 5d). */
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-ink pb-5">
      <div>
        <h1 className="text-[32px] leading-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-ink-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-wider text-ink-muted">{children}</h2>;
}

export function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const cls = size === "lg" ? "h-16 w-16 text-[26px]" : "h-9 w-9 text-[15px]";
  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-full bg-brand font-semibold text-white ${cls}`}>
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
