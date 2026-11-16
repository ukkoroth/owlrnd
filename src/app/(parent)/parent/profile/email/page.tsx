import { ChangeEmailView } from "@/components/profile/ProfileViews";
import { requireShell } from "@/server/auth/current";

export const metadata = { title: "Change email · owlrnd" };

export default async function ChangeEmailPage() {
  const { user: { parent } } = await requireShell("parent");
  return <ChangeEmailView email={parent.email} base="/parent/profile" />;
}
