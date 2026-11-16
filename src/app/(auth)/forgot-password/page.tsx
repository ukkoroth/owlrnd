import type { Metadata } from "next";
import { AuthHeading, AuthLayout } from "@/components/AuthLayout";
import { ForgotForm } from "./ForgotForm";

export const metadata: Metadata = { title: "Forgot password · owlrnd" };

// 5g
export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const { expired } = await searchParams;
  return (
    <AuthLayout variant="tagline">
      <AuthHeading title="Forgot your password?">
        Enter your email or username. We will send a reset code to the email that controls the account.
      </AuthHeading>
      <ForgotForm notice={expired ? "That step timed out. Ask for a new reset code." : undefined} />
    </AuthLayout>
  );
}
