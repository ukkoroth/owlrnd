import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading, AuthLayout } from "@/components/AuthLayout";
import { maskEmail } from "@/domain/codes";
import { openRequest, sendParentCode } from "@/server/consent";
import { ParentConsentForm } from "./ParentConsentForm";

export const metadata: Metadata = { title: "Do you agree? · owlrnd", robots: { index: false } };
export const dynamic = "force-dynamic";

const formatDob = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`)) : null;

// sm-1f: the parent opens this from the email. No account is needed; a code to their email proves it's them.
export default async function ParentConsentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const open = await openRequest(decodeURIComponent(token));
  if (!open) {
    return (
      <AuthLayout variant="tagline">
        <AuthHeading title="This link has expired">
          Consent links work for a few days and only the newest one works. Ask the learner to send you a new one from owlrnd.
        </AuthHeading>
        <Link href="/" className="btn-outline">
          Go to owlrnd.com
        </Link>
      </AuthLayout>
    );
  }
  const { request, learner } = open;
  // Opening the page sends the code, unless a code from the last 10 minutes is still unused.
  if (!request.codeExpiresAt || request.codeExpiresAt <= new Date() || request.codeUsedAt || request.codeTriesLeft <= 0) await sendParentCode(open);
  const born = formatDob(learner.dateOfBirth);

  return (
    <AuthLayout
      variant="message"
      headline={<>{learner.name} is practising on owlrnd.</>}
      lead={
        <>
          {learner.name}
          {born ? ` (born ${born})` : ""} has signed up and started practising. Because {learner.name} is under 18, we need a parent or guardian to agree.
        </>
      }
    >
      <AuthHeading title="Do you agree?">Read what owlrnd does, confirm your email with a code, and give your consent. It takes a minute.</AuthHeading>
      <div className="mb-5 grid gap-4 rounded border border-line bg-card px-4 py-4 text-[14px] sm:grid-cols-2">
        <div>
          <h2 className="mb-2 text-[12px] font-bold uppercase tracking-wider text-brand">What we keep</h2>
          <ul className="flex list-disc flex-col gap-1 pl-4">
            <li>Name, email, date of birth</li>
            <li>Tracks, answers and scores</li>
            <li>Material {learner.name} uploads</li>
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-[12px] font-bold uppercase tracking-wider text-brand">What we never do</h2>
          <ul className="flex list-disc flex-col gap-1 pl-4">
            <li>Show ads</li>
            <li>Sell or share data</li>
            <li>Track {learner.name} outside owlrnd</li>
          </ul>
        </div>
      </div>
      <ParentConsentForm token={decodeURIComponent(token)} learnerName={learner.name} maskedEmail={maskEmail(request.parentEmail)} />
    </AuthLayout>
  );
}
