import type { Metadata } from "next";
import { AuthHeading, AuthLayout } from "@/components/AuthLayout";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: "Sign in · owlrnd" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ expired?: string; deleted?: string }> }) {
  const { expired, deleted } = await searchParams;
  return (
    <AuthLayout variant="tagline">
      <AuthHeading title="Sign in">Students and parents sign in here.</AuthHeading>
      <SignInForm
        notice={
          deleted ? "Your account has been deleted." : expired ? "That step timed out. Sign in again to get a new code." : undefined
        }
      />
    </AuthLayout>
  );
}
