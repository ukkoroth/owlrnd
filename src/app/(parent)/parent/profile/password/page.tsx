import { PageHeader } from "@/components/PageHeader";
import { requireShell } from "@/server/auth/current";
import { PasswordForm } from "../ProfileForms";

export const metadata = { title: "Change password · owlrnd" };

export default async function ChangePasswordPage() {
  await requireShell("parent");
  return (
    <div className="max-w-[480px]">
      <PageHeader title="Change your password" subtitle="Other devices will be signed out." />
      <PasswordForm />
    </div>
  );
}
