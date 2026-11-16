import { count, eq } from "drizzle-orm";
import { DeleteAccountView } from "@/components/profile/ProfileViews";
import { requireShell } from "@/server/auth/current";
import { db } from "@/server/db";
import { students } from "@/server/db/schema";

export const metadata = { title: "Delete account · owlrnd" };

export default async function DeleteAccountPage() {
  const { user: { parent } } = await requireShell("parent");
  const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(students).where(eq(students.parentId, parent.id));
  const warning = `This deletes your account${n ? ` and your ${n === 1 ? "student" : `${n} students`}, with all their tracks, exams and points` : ""}. It cannot be undone.`;
  return <DeleteAccountView warning={warning} base="/parent/profile" />;
}
