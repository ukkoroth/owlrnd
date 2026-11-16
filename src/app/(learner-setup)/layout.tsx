import { requireShell } from "@/server/auth/current";

// Full-screen set-up pages for a signed-in learner (sm-1d): no sidebar, as in the mockups.
export default async function LearnerSetupLayout({ children }: { children: React.ReactNode }) {
  await requireShell("learner");
  return children;
}
