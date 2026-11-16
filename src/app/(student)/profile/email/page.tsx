import { notFound } from "next/navigation";
import { ChangeEmailView } from "@/components/profile/ProfileViews";
import { requireShell } from "@/server/auth/current";

export const metadata = { title: "Change email · owlrnd" };

export default async function LearnerChangeEmailPage() {
  const { user: { student } } = await requireShell("learner");
  if (student.type !== "self_managed" || !student.email) notFound();
  return <ChangeEmailView email={student.email} base="/profile" />;
}
