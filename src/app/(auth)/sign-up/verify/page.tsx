import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthHeading, AuthLayout } from "@/components/AuthLayout";
import { getParent } from "@/server/auth/accounts";
import { getPending } from "@/server/auth/current";
import { resendVerifyCode, verifyEmail } from "../../actions";
import { CodeForm } from "@/components/CodeForm";
import { sendLimitMessage } from "@/lib/codeMessages";

export const metadata: Metadata = { title: "Verify your email · owlrnd" };

// 1b
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ limit?: string }> }) {
  const pending = await getPending("verify_email");
  if (!pending?.parentId) redirect("/sign-up");
  const parent = await getParent(pending.parentId);
  if (!parent) redirect("/sign-up");
  const { limit } = await searchParams;

  return (
    <AuthLayout variant="steps" headline="Check your inbox.">
      <AuthHeading title="Verify your email">
        We sent a 6-digit code to <strong className="text-ink">{parent.email}</strong>. Enter it below to confirm the address is yours.
      </AuthHeading>
      <CodeForm
        action={verifyEmail}
        resend={resendVerifyCode}
        submitLabel="Verify email"
        resendLabel="Resend code"
        back={{ href: "/sign-up?change=1", label: "Use a different email" }}
        initialError={limit ? sendLimitMessage : undefined}
        footnote="The code is valid for 10 minutes. If it has not arrived, check your spam folder."
      />
    </AuthLayout>
  );
}
