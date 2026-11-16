import { CodeForm } from "@/components/CodeForm";
import { PageHeader } from "@/components/PageHeader";
import { resendEmailChange, verifyEmailChange } from "@/app/_actions/profile";
import { DeleteForm, EmailForm, NameForm, PasswordForm } from "./ProfileForms";

// The account holder's profile sub-pages, shared by the parent (/parent/profile/…) and the self-managed learner
// (/profile/…). `base` is the profile page each belongs to.

export function EditNameView({ name, base }: { name: string; base: string }) {
  return (
    <div className="max-w-[480px]">
      <PageHeader title="Edit your name" />
      <NameForm name={name} base={base} />
    </div>
  );
}

export function ChangeEmailView({ email, base }: { email: string; base: string }) {
  return (
    <div className="max-w-[480px]">
      <PageHeader
        title="Change your email"
        subtitle={
          <>
            Now: <strong className="text-ink">{email}</strong>. We will send a code to the new address; the change takes effect once you enter it.
          </>
        }
      />
      <EmailForm base={base} />
    </div>
  );
}

export function VerifyNewEmailView({ newEmail, base }: { newEmail: string; base: string }) {
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
        back={{ href: base, label: "Cancel" }}
        footnote="The code is valid for 10 minutes. Until you enter it, sign-in codes keep going to your current email."
      />
    </div>
  );
}

export function ChangePasswordView({ base }: { base: string }) {
  return (
    <div className="max-w-[480px]">
      <PageHeader title="Change your password" subtitle="Other devices will be signed out." />
      <PasswordForm base={base} />
    </div>
  );
}

export function DeleteAccountView({ warning, base }: { warning: string; base: string }) {
  return (
    <div className="max-w-[520px]">
      <PageHeader title="Delete your account" />
      <div className="mb-5 rounded border border-danger bg-danger-fill px-4 py-3 text-danger-text">{warning}</div>
      <p className="mb-4 text-ink-muted">Enter your password to confirm.</p>
      <DeleteForm base={base} />
    </div>
  );
}
