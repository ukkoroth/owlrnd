import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumb";
import { PageHeader } from "@/components/PageHeader";
import { requireShell } from "@/server/auth/current";
import { getOwnStudent } from "@/server/students";
import { EditStudentForms } from "./EditStudentForms";

export const metadata: Metadata = { title: "Edit student · owlrnd" };

// 5e
export default async function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { actor } = await requireShell("parent");
  const { id } = await params;
  const student = await getOwnStudent(actor, id);
  if (!student) notFound();

  return (
    <div className="max-w-[760px]">
      <Breadcrumb items={[{ label: "Students", href: "/students" }, { label: student.name }, { label: "Edit" }]} />
      <PageHeader title={`Edit ${student.name}`} />
      <EditStudentForms student={{ id: student.id, name: student.name, className: student.className, username: student.username ?? "", ...dobParts(student.dateOfBirth) }} />
    </div>
  );
}

/** "2012-03-09" → the three boxes (day "9", month "3", year "2012"); blank when there is no date. */
function dobParts(iso: string | null) {
  const [y, m, d] = iso ? iso.split("-") : ["", "", ""];
  return { dobDay: d ? String(Number(d)) : "", dobMonth: m ? String(Number(m)) : "", dobYear: y ?? "" };
}
