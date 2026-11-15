import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, LegalPage, Mail, P, Section } from "@/components/landing/LegalPage";
import { rules } from "@/config/rules";

export const metadata: Metadata = { title: "Contact · owlrnd" };

export default function ContactPage() {
  return (
    <LegalPage
      title="Contact"
      intro={
        <p className="m-0">
          Questions, feedback from the beta, or something that doesn&apos;t look right? Email us and we&apos;ll get back to you.
        </p>
      }
    >
      <Section title="Email">
        <P>
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-[22px] font-semibold text-brand underline underline-offset-4 hover:text-sidebar">
            {CONTACT_EMAIL}
          </a>
        </P>
      </Section>
      <Section title="Can't sign in?">
        <P>
          Every sign-in needs a 6-digit code sent to the parent&apos;s email. If it hasn&apos;t arrived, check the spam
          folder, or ask for a new code on the sign-in screen. Children: ask your parent for the code. If you&apos;ve forgotten
          a password, use{" "}
          <Link href="/forgot-password" className="link">
            Forgot password
          </Link>
          .
        </P>
      </Section>
      <Section title="Privacy and your data">
        <P>
          To see, correct or delete your or your child&apos;s data, write to <Mail subject="Privacy request" /> from the email
          address on the account. Our{" "}
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
