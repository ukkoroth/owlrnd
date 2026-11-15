import { requireStudent } from "@/server/auth/current";

// The exam paper is full screen (no sidebar). Only students take exams (rules §10).
export default async function PaperLayout({ children }: { children: React.ReactNode }) {
  await requireStudent();
  return <div className="bg-paper-bg text-paper-ink">{children}</div>;
}
