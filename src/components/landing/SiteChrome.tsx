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
