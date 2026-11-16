import { requireShell } from "@/server/auth/current";

// Full-screen paper views for parents (a student's marked paper, from exam history 2h). Rules §10.
export default async function ParentPaperLayout({ children }: { children: React.ReactNode }) {
  await requireShell("parent");
  return <div className="bg-paper-bg text-paper-ink">{children}</div>;
}
