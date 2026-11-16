import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { rules } from "@/config/rules";
import { SiteFooter, SiteHeader } from "@/components/landing/SiteChrome";
import { GetAccessForm } from "./GetAccessForm";

export const metadata: Metadata = { title: "Get access · owlrnd" };

/** Closed beta: the landing page's "Get access" buttons lead here. */
export default async function GetAccessPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  // Sign-up is open: there is nothing to ask for.
  if (!rules.access.inviteOnly) redirect("/sign-up");
  const { sent } = await searchParams;
  return (
    <div className="flex min-h-screen flex-col bg-page text-ink">
      <SiteHeader />
      <main className="flex-1 px-6 py-16 md:py-20">
        <div className="mx-auto grid max-w-[1180px] items-start gap-x-16 gap-y-10 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <span className="text-sm font-bold uppercase tracking-[0.06em] text-brand">Closed beta</span>
            <h1 className="m-0 text-balance text-[clamp(2rem,4vw,2.75rem)] font-bold leading-[1.1] tracking-[-0.02em]">
              {sent ? "Thanks, we've got your request." : "Get access to owlrnd."}
            </h1>
            <p className="m-0 text-[17px] leading-[1.55] text-ink-muted">
              {sent
                ? "We're letting families in a few at a time. When there's a place for you, we'll email you an invitation link to create your parent account."
                : "We're opening owlrnd to a small group of families first. Leave your details and we'll email you an invitation when there's a place."}
            </p>
          </div>
          <div className="card">
            {sent ? (
              <div role="status" className="flex flex-col gap-4">
                <h2 className="m-0 text-lg font-semibold">Request received</h2>
                <p className="m-0 text-ink-muted">Keep an eye on your inbox. The invitation comes from owlrnd.</p>
                <Link href="/" className="btn-outline self-start">
                  Back to the home page
                </Link>
              </div>
            ) : (
              <GetAccessForm />
            )}
            <p className="mb-0 mt-5 text-center text-sm text-ink-muted">
              Already have an account?{" "}
              <Link href="/sign-in" className="link font-semibold">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
