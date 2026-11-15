import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "./SiteChrome";

/** Who runs owlrnd and how to reach them; used on the Privacy, Terms and Contact pages. */
export const OPERATOR = "Unni Koroth";
export const CONTACT_EMAIL = "hello@owlrnd.com";

/** Long-form public pages (Privacy, Terms, Contact): site header and footer around a readable column. */
export function LegalPage({ title, updated, intro, children }: { title: string; updated?: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-page text-ink">
      <SiteHeader />
      <main className="flex-1 px-6 py-16 md:py-20">
        <article className="mx-auto max-w-[760px]">
          <h1 className="m-0 text-[clamp(2rem,4vw,2.75rem)] font-bold leading-[1.1] tracking-[-0.02em]">{title}</h1>
          {updated && <p className="mt-3 text-sm text-ink-muted">Last updated {updated}</p>}
          {intro && <div className="mt-6 text-[17px] leading-[1.6] text-ink-muted">{intro}</div>}
          <div className="mt-10 flex flex-col gap-10">{children}</div>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="m-0 text-[22px] font-semibold leading-tight">{title}</h2>
      {children}
    </section>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="m-0 text-base leading-[1.65] text-ink">{children}</p>;
}

export function List({ children }: { children: ReactNode }) {
  return <ul className="m-0 flex list-disc flex-col gap-1.5 pl-6 text-base leading-[1.6] text-ink marker:text-ink-muted">{children}</ul>;
}

export function Mail({ subject }: { subject?: string }) {
  const href = `mailto:${CONTACT_EMAIL}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
  return (
    <a href={href} className="link">
      {CONTACT_EMAIL}
    </a>
  );
}
