import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { pendingNewEmail } from "@/server/auth/codes";
import { requireShell } from "@/server/auth/current";
import { CodeForm } from "@/components/CodeForm";
import { resendEmailChange, verifyEmailChange } from "../../actions";

export const metadata = { title: "Confirm new email · owlrnd" };

export default async function VerifyNewEmailPage() {
  const { user: { parent } } = await requireShell("parent");
  const newEmail = await pendingNewEmail({ parentId: parent.id, studentId: null });
  if (!newEmail) redirect("/parent/profile/email");
  return (
    <div className="max-w-[480px]">
      <PageHeader
        title="Confirm your new email"
        subtitle={
          <>
            We sent a 6-digit code to <strong className="text-ink">{newEmail}</strong>. Enter it to finish the change.
          </>
        }
      />
      <CodeForm
        action={verifyEmailChange}
        resend={resendEmailChange}
        submitLabel="Confirm email"
        resendLabel="Send a new code"
        back={{ href: "/parent/profile", label: "Cancel" }}
        footnote="The code is valid for 10 minutes. Until you enter it, sign-in codes keep going to your current email."
      />
    </div>
  );
}
