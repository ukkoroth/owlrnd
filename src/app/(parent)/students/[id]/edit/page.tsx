import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumb";
import { PageHeader } from "@/components/PageHeader";
import { requireParent } from "@/server/auth/current";
import { getOwnStudent } from "@/server/students";
import { EditStudentForms } from "./EditStudentForms";

export const metadata: Metadata = { title: "Edit student · owlrnd" };

// 5e
export default async function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { parent } = await requireParent();
  const { id } = await params;
  const student = await getOwnStudent(parent.id, id);
  if (!student) notFound();

  return (
    <div className="max-w-[760px]">
      <Breadcrumb items={[{ label: "Students", href: "/students" }, { label: student.name }, { label: "Edit" }]} />
      <PageHeader title={`Edit ${student.name}`} />
      <EditStudentForms student={{ id: student.id, name: student.name, className: student.className, username: student.username }} />
    </div>
  );
}
