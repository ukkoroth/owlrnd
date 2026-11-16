import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { AuthHeading, AuthLayout, LEARNER_STEPS } from "@/components/AuthLayout";
import { rules } from "@/config/rules";
import { checkInvitation, hasOpenClaim } from "@/server/access";
import { getLearner, getParent } from "@/server/auth/accounts";
import { getPending } from "@/server/auth/current";
import { LearnerSignUpForm } from "./LearnerSignUpForm";
import { SignUpForm } from "./SignUpForm";

export const metadata: Metadata = { title: "Create an account · owlrnd" };

const parentHeadline = (
  <>
    Set up exam
    <br />
    practice for
    <br />
    your child.
  </>
);

const learnerHeadline = (
  <>
    Set up practice
    <br />
    for your exam.
  </>
);

type Search = { for?: string; change?: string; invite?: string; under18?: string; young?: string };

/**
 * Sign-up starts with "Who is this account for?" (sm-1a). ?for=me is the learner's sign-up (sm-1b), ?for=child the
 * parent's (P·1a). With &change=1 (from verify, "Use a different email") the form is prefilled from the account
 * being set up. While sign-up is invite-only, both need ?invite=<token>.
 */
export default async function SignUpPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  if (params.for === "me") return <ForMe {...params} />;
  if (params.for === "child") return <ForMyChild {...params} />;
  return <WhoIsItFor invite={params.invite} />;
}

const withInvite = (path: string, invite?: string) => (invite ? `${path}&invite=${encodeURIComponent(invite)}` : path);

// ── sm-1a ──────────────────────────────────────────────────────────────────

function WhoIsItFor({ invite }: { invite?: string }) {
  return (
    <AuthLayout variant="rank">
      <AuthHeading title="Who is this account for?">Choose one to start. It decides who sets up the practice and who gets the sign-in codes.</AuthHeading>
      <div className="flex flex-col gap-5">
        <Choice href={withInvite("/sign-up?for=me", invite)} title="For me" icon={<PersonIcon />}>
          I&apos;m preparing for an exam or studying, and I&apos;ll set up my own practice.
        </Choice>
        <Choice href={withInvite("/sign-up?for=child", invite)} title="For my child" icon={<FamilyIcon />}>
          I&apos;m a parent. I&apos;ll set up practice for my children and follow their progress.
        </Choice>
      </div>
      <p className="mt-6 text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link href="/sign-in" className="link font-semibold">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}

function Choice({ href, title, icon, children }: { href: string; title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex min-h-touch items-center gap-4 rounded border border-line-input bg-white px-5 py-5 text-ink no-underline hover:border-brand focus-visible:outline-brand"
    >
      <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pale text-sidebar">
        {icon}
      </span>
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-lg font-semibold">{title}</span>
        <span className="text-[15px] leading-snug text-ink-muted">{children}</span>
      </span>
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-brand">
        <path d="m9 6 6 6-6 6" />
      </svg>
    </Link>
  );
}

function ChangeLink({ label }: { label: string }) {
  return (
    <Link href="/sign-up" className="link mb-4 inline-flex min-h-touch items-center text-sm font-semibold">
      ← {label} · change
    </Link>
  );
}

// ── sm-1b For me ───────────────────────────────────────────────────────────

async function ForMe({ change, invite, under18, young }: Search) {
  if (under18 || young) {
    const age = young ? rules.accounts.ages.learner.min : rules.accounts.ages.adult;
    return (
      <AuthLayout variant="steps" headline={learnerHeadline} steps={LEARNER_STEPS}>
        <ChangeLink label="For me" />
        <AuthHeading title="Ask a parent to help you sign up">
          You need to be {age} or over to create your own owlrnd account. A parent can set up practice for you, and you sign in with the username they give you.
        </AuthHeading>
        <Link href="/sign-up?for=child" className="btn-primary">
          Set up with a parent
        </Link>
      </AuthLayout>
    );
  }

  const pending = change ? await getPending("verify_email") : null;
  const learner = pending?.studentId && !pending.parentId ? await getLearner(pending.studentId) : null;
  const gate = await inviteGate(invite, !!learner && (await hasOpenClaim({ studentId: learner.id })), learnerHeadline);
  if (!gate.ok) return gate.page;

  return (
    <AuthLayout variant="steps" headline={learnerHeadline} steps={LEARNER_STEPS}>
      <ChangeLink label="For me" />
      <AuthHeading title="Create your account">Your own practice. You set up your tracks and the sign-in codes come to you.</AuthHeading>
      <LearnerSignUpForm initialName={learner?.name} initialEmail={gate.invitedEmail} invite={invite} changingEmail={!!learner} />
    </AuthLayout>
  );
}

// ── P·1a For my child ──────────────────────────────────────────────────────

async function ForMyChild({ change, invite }: Search) {
  const pending = change ? await getPending("verify_email") : null;
  const parent = pending?.parentId ? await getParent(pending.parentId) : null;
  const gate = await inviteGate(invite, !!parent && (await hasOpenClaim({ parentId: parent.id })), parentHeadline);
  if (!gate.ok) return gate.page;

  return (
    <AuthLayout variant="steps" headline={parentHeadline}>
      <ChangeLink label="For my child" />
      <AuthHeading title="Create a parent account">Parents sign up first, then create the student account.</AuthHeading>
      <SignUpForm initialName={parent?.name} initialEmail={gate.invitedEmail} invite={invite} changingEmail={!!parent} />
    </AuthLayout>
  );
}

// ── Closed beta (rules.access.inviteOnly) ──────────────────────────────────

async function inviteGate(
  invite: string | undefined,
  holdsClaim: boolean,
  headline: ReactNode,
): Promise<{ ok: true; invitedEmail?: string } | { ok: false; page: ReactNode }> {
  if (!rules.access.inviteOnly || holdsClaim) return { ok: true };
  const invitation = await checkInvitation(invite);
  if (invitation.ok) return { ok: true, invitedEmail: invitation.email };
  return { ok: false, page: <InviteOnly expired={invitation.reason === "invalid"} headline={headline} /> };
}

function InviteOnly({ expired, headline }: { expired: boolean; headline: ReactNode }) {
  return (
    <AuthLayout variant="steps" headline={headline}>
      <AuthHeading title={expired ? "This invitation link has expired" : "owlrnd is invite-only for now"}>
        {expired
          ? "Invitation links work once and expire after a while. Ask for access again and we'll send you a new one."
          : "We're in a closed beta with a small group of families. Ask for access and we'll email you an invitation."}
      </AuthHeading>
      <div className="flex flex-col gap-3">
        <Link href="/get-access" className="btn-primary">
          Get access
        </Link>
        <p className="mt-2 text-center text-sm text-ink-muted">
          Already have an account?{" "}
          <Link href="/sign-in" className="link font-semibold">
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}

// ── Icons (decorative) ─────────────────────────────────────────────────────

const iconProps = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const };

function PersonIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" />
    </svg>
  );
}

function FamilyIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-5.2 6-5.2s6 1.9 6 5.2" />
      <circle cx="17" cy="10" r="2.4" />
      <path d="M15.5 14.9c.5-.1 1-.1 1.5-.1 2.5 0 4 1.5 4 4.2" />
    </svg>
  );
}
