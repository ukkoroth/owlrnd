import { ChangePasswordView } from "@/components/profile/ProfileViews";
import { requireShell } from "@/server/auth/current";

export const metadata = { title: "Change password · owlrnd" };

export default async function ChangePasswordPage() {
  await requireShell("parent");
  return <ChangePasswordView base="/parent/profile" />;
}
