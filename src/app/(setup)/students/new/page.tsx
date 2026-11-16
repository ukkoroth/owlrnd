import type { Metadata } from "next";
import { requireShell } from "@/server/auth/current";
import { AddStudentFlow } from "./AddStudentFlow";

export const metadata: Metadata = { title: "Add a student · owlrnd" };

// 2a → 2b
export default async function AddStudentPage() {
  const { user: { parent } } = await requireShell("parent");
  return <AddStudentFlow parentEmail={parent.email} />;
}
