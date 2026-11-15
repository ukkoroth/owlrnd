import type { Metadata } from "next";
import { requireParent } from "@/server/auth/current";
import { AddStudentFlow } from "./AddStudentFlow";

export const metadata: Metadata = { title: "Add a student · owlrnd" };

// 2a → 2b
export default async function AddStudentPage() {
  const { parent } = await requireParent();
  return <AddStudentFlow parentEmail={parent.email} />;
}
