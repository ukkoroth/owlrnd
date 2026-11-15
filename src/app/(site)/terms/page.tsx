import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, List, Mail, OPERATOR, P, Section } from "@/components/landing/LegalPage";

export const metadata: Metadata = { title: "Terms of use · owlrnd" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      updated="15 November 2026"
      intro={
        <p className="m-0">
          These terms are the agreement between you and {OPERATOR}, who runs owlrnd. By creating an account or using
          owlrnd, you agree to them. Please also read our{" "}
          <Link href="/privacy" className="link">
            privacy policy
          </Link>
          .
        </p>
      }
    >
      <Section title="The service">
        <P>
          owlrnd lets a parent set up practice tracks for their children from textbook pages, a syllabus or a description.
          owlrnd then writes short, paper-style exams for the child, marks them, and shapes each new exam around the results.
        </P>
        <P>
          owlrnd is in a <strong>closed beta</strong>. It is free while the beta lasts. Features may change, the service may
          sometimes be unavailable, and we may end the beta. If we ever introduce charges, we will tell you first, and nothing
          will be charged without your agreement.
        </P>
      </Section>

      <Section title="Accounts">
        <List>
          <li>Only a parent or legal guardian aged 18 or over may create an account.</li>
          <li>
            You may add only children you are the parent or legal guardian of, and you are responsible for how their
            accounts are used.
          </li>
          <li>
            Keep your password, your children&apos;s passwords and the sign-in codes we email you private. Tell us at{" "}
            <Mail subject="Account security" /> if you think someone else has got into your account.
          </li>
          <li>The details you give us must be accurate, and the email address must be yours.</li>
        </List>
      </Section>

      <Section title="Your material">
        <P>
          You keep all rights to what you upload. You confirm you are allowed to use it for your child&apos;s personal study,
          for example pages of textbooks you own or that the school provided. You give us permission to store and process it,
          including with our AI provider, only to run owlrnd for you.
        </P>
      </Section>

      <Section title="AI-written exams and marking">
        <P>
          Exams, marks and feedback are produced by AI from the material you provide. They can contain mistakes: a wrong
          answer key, a question that is unclear, or a typed answer marked too strictly or too generously. owlrnd is a
          practice aid. It does not replace teachers, school materials or official exams, and we cannot promise any
          particular exam result. If something looks wrong, please tell us.
        </P>
      </Section>

      <Section title="Fair use">
        <P>Please do not:</P>
        <List>
          <li>upload anything unlawful, harmful, or not suitable for children;</li>
          <li>upload other people&apos;s personal data;</li>
          <li>try to get into accounts that are not yours, or to break, overload or copy the service;</li>
          <li>sell or share access to your account with people outside your family.</li>
        </List>
        <P>We may suspend or close an account that breaks these rules, and will tell you why.</P>
      </Section>

      <Section title="Open-source software">
        <P>
          The owlrnd software is free and open source, licensed under the GNU Affero General Public License, version 3 or
          later. These terms cover the owlrnd service we run. The licence, not these terms, sets what you may do with the
          software itself, including running your own copy.
        </P>
      </Section>

      <Section title="Ending your account">
        <P>
          You can delete your account at any time from your profile; this deletes your children&apos;s accounts and all
          their data too. If we close owlrnd or end the beta, we will give you notice by email first.
        </P>
      </Section>

      <Section title="Our responsibility">
        <P>
          We work to keep owlrnd accurate, available and secure, but we provide it &ldquo;as is&rdquo;, without guarantees.
          As far as the law allows, we are not responsible for indirect losses, and our total responsibility to you is limited
          to the amount you have paid us for owlrnd in the previous 12 months (nothing during the free beta). Nothing in these
          terms limits rights you have that cannot be limited by law.
        </P>
      </Section>

      <Section title="Changes to these terms">
        <P>
          We may update these terms as owlrnd develops. We will change the date on this page, and for important changes we
          will email parents before they take effect. If you keep using owlrnd after that, the new terms apply.
        </P>
      </Section>

      <Section title="Law and disputes">
        <P>
          These terms are governed by the laws of India. Please contact us first so we can try to sort out any problem.
          Otherwise, disputes go to the courts of Kerala, India.
        </P>
      </Section>

      <Section title="Contact">
        <P>
          {OPERATOR}, owlrnd: <Mail />.
        </P>
      </Section>
    </LegalPage>
  );
}
