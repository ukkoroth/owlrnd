import Link from "next/link";
import { rules } from "@/config/rules";
import { site } from "@/config/site";
import { Logo } from "../Logo";

/** Public site header and footer (landing hand-off, sections 1 and 10). App routes: /sign-up (1a), /sign-in (3a). */

const navLink =
  "flex min-h-touch items-center text-[15px] font-medium text-[#EAF1FF] no-underline hover:text-white hover:underline underline-offset-4 focus-visible:outline-white";

export function SiteHeader({ home = false }: { home?: boolean }) {
  // On the landing page the anchors scroll within the page; elsewhere they lead back to it.
  const base = home ? "" : "/";
  return (
    <header className="bg-sidebar text-white">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-3.5">
        <Link href={`${base}#top`} className="flex min-h-touch items-center gap-2.5 text-white no-underline focus-visible:outline-white">
          <Logo />
        </Link>
        <nav aria-label="Main" className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <Link href={`${base}#how`} className={navLink}>
            How it works
          </Link>
          <Link href={`${base}#parents`} className={navLink}>
            For parents
          </Link>
          {site.sourceUrl && <GitHubBadge href={site.sourceUrl} />}
          <Link href="/sign-in" className={navLink}>
            Sign in
          </Link>
          <Link
            href={rules.access.inviteOnly ? "/get-access" : "/sign-up"}
            className="flex h-11 items-center rounded bg-white px-[18px] text-[15px] font-semibold text-sidebar no-underline hover:bg-[#EAF1FF] focus-visible:outline-white"
          >
            {rules.access.inviteOnly ? "Get access" : "Get started"}
          </Link>
        </nav>
      </div>
    </header>
  );
}

/** "Open source" badge linking to the public repository (AGPL-3.0). Text hides on very narrow screens; the label stays for screen readers. */
function GitHubBadge({ href }: { href: string }) {
  return (
    <a
      href={href}
      aria-label="owlrnd is open source: view the code on GitHub"
      className="flex min-h-touch min-w-touch items-center justify-center gap-2 text-[15px] font-medium text-[#EAF1FF] no-underline hover:text-white focus-visible:outline-white"
    >
      <span className="flex h-8 items-center gap-2 rounded border border-[#7AA2FF] px-2.5 hover:border-white">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
        <span aria-hidden="true" className="hidden min-[400px]:inline">
          Open source
        </span>
      </span>
    </a>
  );
}

const footerLink = "flex min-h-touch items-center text-[#D3E0FF] underline underline-offset-2 hover:text-white focus-visible:outline-white";

export function SiteFooter() {
  return (
    <footer className="bg-ink px-6 py-7 text-[#D3E0FF]">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-x-6 gap-y-3 text-sm">
        <span className="flex items-center gap-2">
          <span className="text-[17px] font-bold text-white">owlrnd</span>
          <span>© {new Date().getFullYear()}</span>
        </span>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-1">
          <Link href="/sign-in" className={footerLink}>
            Sign in
          </Link>
          <Link href="/privacy" className={footerLink}>
            Privacy
          </Link>
          <Link href="/terms" className={footerLink}>
            Terms
          </Link>
          <Link href="/contact" className={footerLink}>
            Contact
          </Link>
          {site.sourceUrl && (
            <a href={site.sourceUrl} className={footerLink}>
              Source code
            </a>
          )}
        </nav>
      </div>
    </footer>
  );
}
