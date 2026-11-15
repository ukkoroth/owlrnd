import { count, eq } from "drizzle-orm";
import { PageHeader } from "@/components/PageHeader";
import { requireParent } from "@/server/auth/current";
import { db } from "@/server/db";
import { students } from "@/server/db/schema";
import { DeleteForm } from "../ProfileForms";

export const metadata = { title: "Delete account · owlrnd" };

export default async function DeleteAccountPage() {
  const { parent } = await requireParent();
  const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(students).where(eq(students.parentId, parent.id));
  return (
    <div className="max-w-[520px]">
      <PageHeader title="Delete your account" />
      <div className="mb-5 rounded border border-danger bg-danger-fill px-4 py-3 text-danger-text">
        This deletes your account{n ? ` and your ${n === 1 ? "student" : `${n} students`}, with all their tracks, exams and points` : ""}. It cannot be undone.
      </div>
      <p className="mb-4 text-ink-muted">Enter your password to confirm.</p>
      <DeleteForm />
    </div>
  );
}
