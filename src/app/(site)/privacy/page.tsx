import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, List, Mail, OPERATOR, P, Section } from "@/components/landing/LegalPage";

export const metadata: Metadata = { title: "Privacy policy · owlrnd" };

// Facts below must match the app: docs/06-data.md (what is stored), docs/07-ai.md (what the AI sees),
// private/infra.md (where it runs; owner only). Change this page when any of them change.
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="15 November 2026"
      intro={
        <p className="m-0">
          owlrnd helps school students practise with short exams that a parent sets up. Children use it, so we keep what we
          collect to the minimum the service needs, we never sell it, and a parent can delete all of it at any time. This page
          explains what we collect, why, who helps us process it, and your rights under India&apos;s Digital Personal Data
          Protection Act, 2023.
        </p>
      }
    >
      <Section title="Who we are">
        <P>
          owlrnd is run by {OPERATOR}, in India, who is responsible for your personal data (the &ldquo;data fiduciary&rdquo;).
          For anything about your data, write to <Mail subject="Privacy" />.
        </P>
        <P>owlrnd is in a closed beta. It is free during the beta, and there are no payments, ads or in-app purchases.</P>
      </Section>

      <Section title="Parents set up every account">
        <P>
          A parent or guardian creates their own account and then adds each child. Children never give us an email address
          or phone number. By adding a child, the parent confirms they are the child&apos;s parent or legal guardian and agrees
          to us processing the child&apos;s data as described here. Every sign-in, the child&apos;s included, needs a code
          sent to the parent&apos;s email, so the parent knows whenever the account is used.
        </P>
      </Section>

      <Section title="What we collect">
        <List>
          <li>
            <strong>About the parent:</strong> name, email address, password (stored only as a secure hash) and time zone.
          </li>
          <li>
            <strong>About each child:</strong> name, school class, username, password (stored only as a secure hash) and
            time zone. No email, phone number, photo, school name or address.
          </li>
          <li>
            <strong>Study material:</strong> photos or PDFs of textbook pages and syllabuses you upload, the text we read from
            them, and your chat with the owlrnd AI when you set up a track.
          </li>
          <li>
            <strong>Practice records:</strong> the exams written for your child, their answers, marks and feedback, topic
            strengths, goals and points.
          </li>
          <li>
            <strong>Sign-in and security:</strong> one-time codes (stored as a hash and valid for 10 minutes), signed-in
            sessions with the browser they came from, and failed sign-in attempts with the IP address, to stop people
            guessing passwords.
          </li>
          <li>
            <strong>Access requests:</strong> if you ask for access to the beta, your name, email and the optional note you
            write.
          </li>
        </List>
      </Section>

      <Section title="How we use it">
        <List>
          <li>To run owlrnd: create tracks, write exams, mark them, and show results and progress.</li>
          <li>To send sign-in codes, password reset codes and beta invitations by email.</li>
          <li>To keep accounts secure and the service working, and to fix problems.</li>
        </List>
        <P>
          We do not sell personal data, show advertising, track children across other websites or apps, or build profiles of
          children for any purpose other than adapting their practice.
        </P>
      </Section>

      <Section title="How the AI uses your material">
        <P>
          owlrnd uses Claude, an AI model made by Anthropic, to read your study material, agree a track with you, write
          exam questions and mark typed answers. To do this we send Anthropic the relevant material, your chat messages, the
          questions and your child&apos;s typed answers. These requests can include the parent&apos;s first name and the
          child&apos;s first name and class, so that replies can address you properly.
        </P>
        <P>
          Anthropic processes this data to return a result to us. It does not use data sent through its commercial API to
          train its models. Multiple-choice answers are marked by owlrnd itself and are not sent to the AI.
        </P>
      </Section>

      <Section title="Who helps us">
        <List>
          <li>
            <strong>Amazon Web Services</strong> hosts the app, the database and uploaded files, and sends our emails. Your
            data is stored in AWS&apos;s Mumbai region, in India.
          </li>
          <li>
            <strong>Anthropic</strong> provides the AI described above. Its servers are in the United States, so the
            material and answers it processes leave India for that purpose.
          </li>
        </List>
        <P>Both act only on our instructions. We share personal data with no one else, unless the law requires it.</P>
      </Section>

      <Section title="Cookies">
        <P>
          We use one cookie to keep you signed in, and a short-lived one during the sign-in steps. We do not use analytics,
          advertising or tracking cookies.
        </P>
      </Section>

      <Section title="How long we keep it">
        <List>
          <li>Account data, study material and practice records: for as long as the account exists.</li>
          <li>
            <strong>Delete my account</strong> (in the parent&apos;s profile) permanently deletes the parent, every child,
            their tracks, uploaded material, exams and points. <strong>Remove</strong> on a child deletes that child&apos;s
            data.
          </li>
          <li>Deleted data can remain in our encrypted database backups for up to 7 days, after which it is gone.</li>
          <li>Access requests: until the beta ends, or sooner if you ask.</li>
        </List>
      </Section>

      <Section title="Your rights">
        <P>Under the Digital Personal Data Protection Act, 2023, you can ask us to:</P>
        <List>
          <li>tell you what personal data we hold about you or your child, and who we have shared it with;</li>
          <li>correct or update it (most of it you can change yourself in the app);</li>
          <li>delete it;</li>
          <li>withdraw your consent, which means closing the account;</li>
          <li>nominate someone to exercise these rights for you if you die or become unable to.</li>
        </List>
        <P>
          Write to <Mail subject="Privacy request" /> from the email address on the account. We reply within 30 days. If
          you are not satisfied with our answer, you can complain to the Data Protection Board of India.
        </P>
      </Section>

      <Section title="Keeping data safe">
        <P>
          Passwords and codes are stored only as secure hashes. Data is encrypted in transit and at rest, uploaded files are
          kept in private storage, and the database is not reachable from the internet. No system is perfectly secure; if a
          breach affects your data, we will tell you and the Data Protection Board as the law requires.
        </P>
      </Section>

      <Section title="Changes to this policy">
        <P>
          If we change this policy, we will update this page and its date. If a change affects how we use your or your
          child&apos;s data, we will email parents before it takes effect.
        </P>
      </Section>

      <Section title="Contact">
        <P>
          {OPERATOR}, owlrnd: <Mail subject="Privacy" />. See also our{" "}
          <Link href="/terms" className="link">
            terms of use
          </Link>
          .
        </P>
      </Section>
    </LegalPage>
  );
}
