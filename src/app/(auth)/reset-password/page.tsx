import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthHeading, AuthLayout } from "@/components/AuthLayout";
import { maskEmail } from "@/domain/codes";
import { getParent } from "@/server/auth/accounts";
import { getPending } from "@/server/auth/current";
import { sendLimitMessage } from "@/lib/codeMessages";
import { ResetForm } from "./ResetForm";

export const metadata: Metadata = { title: "Set a new password · owlrnd" };

// 5h
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ limit?: string }> }) {
  const pending = await getPending("reset_password");
  if (!pending) redirect("/forgot-password?expired=1");
  const parent = await getParent(pending.parentId);
  if (!parent) redirect("/forgot-password");
  const { limit } = await searchParams;

  return (
    <AuthLayout variant="tagline">
      <AuthHeading title="Set a new password">
        Enter the 6-digit code sent to <strong className="text-ink">{maskEmail(parent.email)}</strong> and choose a new password.
        {pending.studentId ? " Students: ask your parent for the code." : ""}
      </AuthHeading>
      <ResetForm initialError={limit ? sendLimitMessage : undefined} />
    </AuthLayout>
  );
}
