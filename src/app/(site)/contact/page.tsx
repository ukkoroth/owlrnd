import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, LegalPage, Mail, P, Section } from "@/components/landing/LegalPage";
import { rules } from "@/config/rules";
import { currentHolder } from "@/server/packageRequests";
import { PackageRequestForm } from "./PackageRequestForm";

export const metadata: Metadata = { title: "Contact · owlrnd" };

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topic?: string; sent?: string }> }) {
  const { topic, sent } = await searchParams;
  // A signed-in account holder (a parent, or a self-managed learner) has their details filled in.
  const holder = topic === "package" ? await currentHolder().catch(() => null) : null;
  return (
    <LegalPage
      title="Contact"
      intro={
        <p className="m-0">
          Questions, feedback from the beta, or something that doesn&apos;t look right? Email us and we&apos;ll get back to you.
        </p>
      }
    >
      {topic === "package" && (
        <Section title="Buy a package">
          {sent ? (
            <div role="status" className="card flex flex-col gap-2">
              <p className="m-0 font-semibold">Thanks, we&apos;ve got your message.</p>
              <p className="m-0 text-ink-muted">We&apos;ll email you about packages soon.</p>
            </div>
          ) : (
            <>
              <P>Used up your demo AI allowance? Tell us and we&apos;ll get back to you about a package. Nothing is charged here.</P>
              <PackageRequestForm name={holder?.name} email={holder?.email} />
            </>
          )}
        </Section>
      )}
      <Section title="Email">
        <P>
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-[22px] font-semibold text-brand underline underline-offset-4 hover:text-sidebar">
            {CONTACT_EMAIL}
          </a>
        </P>
      </Section>
      <Section title="Can't sign in?">
        <P>
          Every sign-in needs a 6-digit code sent to the account&apos;s email: your own if you signed up for yourself, or your
          parent&apos;s if they set up your account. If it hasn&apos;t arrived, check the spam folder, or ask for a new code on
          the sign-in screen. If you&apos;ve forgotten a password, use{" "}
          <Link href="/forgot-password" className="link">
            Forgot password
          </Link>
          .
        </P>
      </Section>
      <Section title="Privacy and your data">
        <P>
          To see, correct or delete your or your child&apos;s data, or to withdraw a parent&apos;s consent, write to{" "}
          <Mail subject="Privacy request" /> from the email address on the account. Our{" "}
          <Link href="/privacy" className="link">
            privacy policy
          </Link>{" "}
          explains your rights.
        </P>
      </Section>
      {rules.access.inviteOnly && (
        <Section title="Joining the beta">
          <P>
            owlrnd is invite-only for now.{" "}
            <Link href="/get-access" className="link">
              Ask for access
            </Link>{" "}
            and we&apos;ll email you an invitation.
          </P>
        </Section>
      )}
    </LegalPage>
  );
}
