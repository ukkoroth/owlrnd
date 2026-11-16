import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading, AuthLayout } from "@/components/AuthLayout";
import { rules } from "@/config/rules";
import { checkInvitation, hasOpenClaim } from "@/server/access";
import { getParent } from "@/server/auth/accounts";
import { getPending } from "@/server/auth/current";
import { SignUpForm } from "./SignUpForm";

export const metadata: Metadata = { title: "Create a parent account · owlrnd" };

const headline = (
  <>
    Set up exam
    <br />
    practice for
    <br />
    your child.
  </>
);

// 1a. With ?change=1 (from 1b "Use a different email") the form is prefilled from the account being set up.
// Closed beta: needs ?invite=<token> from an invitation email, unless the account being set up already holds one.
export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ change?: string; invite?: string }> }) {
  const { change, invite } = await searchParams;
  const pending = change ? await getPending("verify_email") : null;
  const parent = pending?.parentId ? await getParent(pending.parentId) : null;

  let invitedEmail: string | undefined;
  if (rules.access.inviteOnly && !(parent && (await hasOpenClaim(parent.id)))) {
    const invitation = await checkInvitation(invite);
    if (!invitation.ok) return <InviteOnly expired={invitation.reason === "invalid"} />;
    invitedEmail = invitation.email;
  }

  return (
    <AuthLayout variant="steps" headline={headline}>
      <AuthHeading title="Create a parent account">Parents sign up first, then create the student account.</AuthHeading>
      <SignUpForm initialName={parent?.name} initialEmail={invitedEmail} invite={invite} changingEmail={!!parent} />
    </AuthLayout>
  );
}

function InviteOnly({ expired }: { expired: boolean }) {
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
