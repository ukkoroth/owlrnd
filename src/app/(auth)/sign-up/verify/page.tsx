import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthHeading, AuthLayout, LEARNER_STEPS, PARENT_STEPS } from "@/components/AuthLayout";
import { codeRecipient } from "@/server/auth/codes";
import { getPending } from "@/server/auth/current";
import { resendVerifyCode, verifyEmail } from "../../actions";
import { CodeForm } from "@/components/CodeForm";
import { sendLimitMessage } from "@/lib/codeMessages";

export const metadata: Metadata = { title: "Verify your email · owlrnd" };

// 1b (parent) and sm-1c (For me): the code went to the address being signed up.
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ limit?: string }> }) {
  const pending = await getPending("verify_email");
  if (!pending) redirect("/sign-up");
  const recipient = await codeRecipient(pending).catch(() => null);
  if (!recipient) redirect("/sign-up");
  const { limit } = await searchParams;
  const forMe = !!recipient.selfManaged;

  return (
    <AuthLayout variant="steps" headline="Check your inbox." steps={forMe ? LEARNER_STEPS : PARENT_STEPS}>
      <AuthHeading title="Verify your email">
        We sent a 6-digit code to <strong className="text-ink">{recipient.email}</strong>. Enter it below to confirm the address is yours.
      </AuthHeading>
      <CodeForm
        action={verifyEmail}
        resend={resendVerifyCode}
        submitLabel="Verify email"
        resendLabel="Resend code"
        back={{ href: `/sign-up?for=${forMe ? "me" : "child"}&change=1`, label: "Use a different email" }}
        initialError={limit ? sendLimitMessage : undefined}
        footnote="The code is valid for 10 minutes. If it has not arrived, check your spam folder."
      />
    </AuthLayout>
  );
}
