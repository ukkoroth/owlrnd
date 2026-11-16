import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthHeading, AuthLayout } from "@/components/AuthLayout";
import { maskEmail } from "@/domain/codes";
import { codeRecipient } from "@/server/auth/codes";
import { getPending } from "@/server/auth/current";
import { sendLimitMessage } from "@/lib/codeMessages";
import { ResetForm } from "./ResetForm";

export const metadata: Metadata = { title: "Set a new password · owlrnd" };

// 5h
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ limit?: string }> }) {
  const pending = await getPending("reset_password");
  if (!pending) redirect("/forgot-password?expired=1");
  const recipient = await codeRecipient(pending).catch(() => null);
  if (!recipient) redirect("/forgot-password");
  const { limit } = await searchParams;

  return (
    <AuthLayout variant="tagline">
      <AuthHeading title="Set a new password">
        Enter the 6-digit code sent to <strong className="text-ink">{maskEmail(recipient.email)}</strong> and choose a new password.
        {pending.studentId && !recipient.selfManaged ? " Students: ask your parent for the code." : ""}
      </AuthHeading>
      <ResetForm initialError={limit ? sendLimitMessage : undefined} />
    </AuthLayout>
  );
}
