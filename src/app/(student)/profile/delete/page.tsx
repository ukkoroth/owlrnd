import { notFound } from "next/navigation";
import { DeleteAccountView } from "@/components/profile/ProfileViews";
import { requireShell } from "@/server/auth/current";

export const metadata = { title: "Delete account · owlrnd" };

export default async function LearnerDeleteAccountPage() {
  const { user: { student } } = await requireShell("learner");
  if (student.type !== "self_managed") notFound();
  return <DeleteAccountView warning="This deletes your account with all your tracks, exams and points. It cannot be undone." base="/profile" />;
}
