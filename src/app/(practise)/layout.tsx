import { requireShell } from "@/server/auth/current";

// 0.3 Flashcards: the practice session is full screen (no sidebar), like the exam paper, in the app's colours.
export default async function PractiseLayout({ children }: { children: React.ReactNode }) {
  await requireShell("learner");
  return <div className="min-h-screen bg-page text-ink">{children}</div>;
}
