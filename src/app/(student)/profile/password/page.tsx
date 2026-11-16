import { notFound } from "next/navigation";
import { ChangePasswordView } from "@/components/profile/ProfileViews";
import { requireShell } from "@/server/auth/current";

export const metadata = { title: "Change password · owlrnd" };

export default async function LearnerChangePasswordPage() {
  const { user: { student } } = await requireShell("learner");
  if (student.type !== "self_managed") notFound();
  return <ChangePasswordView base="/profile" />;
}
