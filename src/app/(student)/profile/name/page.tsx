import { notFound } from "next/navigation";
import { EditNameView } from "@/components/profile/ProfileViews";
import { requireShell } from "@/server/auth/current";

export const metadata = { title: "Edit name · owlrnd" };

// sm-5b, self-managed learners only (a child's details are their parent's to change).
export default async function LearnerEditNamePage() {
  const { user: { student } } = await requireShell("learner");
  if (student.type !== "self_managed") notFound();
  return <EditNameView name={student.name} base="/profile" />;
}
