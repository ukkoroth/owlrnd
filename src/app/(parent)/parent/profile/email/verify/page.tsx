import { redirect } from "next/navigation";
import { VerifyNewEmailView } from "@/components/profile/ProfileViews";
import { pendingNewEmail } from "@/server/auth/codes";
import { requireShell } from "@/server/auth/current";

export const metadata = { title: "Confirm new email · owlrnd" };

export default async function VerifyNewEmailPage() {
  const { user: { parent } } = await requireShell("parent");
  const newEmail = await pendingNewEmail({ parentId: parent.id, studentId: null });
  if (!newEmail) redirect("/parent/profile/email");
  return <VerifyNewEmailView newEmail={newEmail} base="/parent/profile" />;
}
