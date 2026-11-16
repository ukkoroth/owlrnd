import { notFound, redirect } from "next/navigation";
import { VerifyNewEmailView } from "@/components/profile/ProfileViews";
import { pendingNewEmail } from "@/server/auth/codes";
import { requireShell } from "@/server/auth/current";

export const metadata = { title: "Confirm new email · owlrnd" };

export default async function LearnerVerifyNewEmailPage() {
  const { user: { student } } = await requireShell("learner");
  if (student.type !== "self_managed") notFound();
  const newEmail = await pendingNewEmail({ parentId: null, studentId: student.id });
  if (!newEmail) redirect("/profile/email");
  return <VerifyNewEmailView newEmail={newEmail} base="/profile" />;
}
