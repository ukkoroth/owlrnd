import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthHeading, AuthLayout } from "@/components/AuthLayout";
import { maskEmail } from "@/domain/codes";
import { getParent } from "@/server/auth/accounts";
import { getPending } from "@/server/auth/current";
import { resendSignInCode, verifySignInCode } from "../../actions";
import { CodeForm } from "@/components/CodeForm";
import { sendLimitMessage } from "@/lib/codeMessages";

export const metadata: Metadata = { title: "Sign-in code · owlrnd" };

// 3b (and 5f when the code is wrong or expired).
export default async function SignInCodePage({ searchParams }: { searchParams: Promise<{ limit?: string }> }) {
  const pending = await getPending("sign_in");
  if (!pending) redirect("/sign-in?expired=1");
  const parent = await getParent(pending.parentId);
  if (!parent) redirect("/sign-in");
  const { limit } = await searchParams;
  const masked = maskEmail(parent.email);

  return (
    <AuthLayout variant="tagline">
      <AuthHeading title="Enter your sign-in code">
        A new 6-digit code was sent to the parent&apos;s registered email, <strong className="text-ink">{masked}</strong>.
        {pending.studentId ? " Ask your parent for the code and enter it below." : " Enter it below."}
      </AuthHeading>
      <CodeForm
        action={verifySignInCode}
        resend={resendSignInCode}
        submitLabel="Sign in"
        resendLabel="Send a new code"
        back={{ href: "/sign-in", label: "Back to sign in" }}
        initialError={limit ? sendLimitMessage : undefined}
        footnote="A code is asked for at every sign-in and works once, for 10 minutes. After 3 wrong tries, a new code is sent automatically. If it has not arrived, check the spam folder."
      />
    </AuthLayout>
  );
}
