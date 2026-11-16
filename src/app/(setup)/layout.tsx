import { requireShell } from "@/server/auth/current";

// Full-screen set-up pages for a signed-in parent (2a, 2b): no sidebar, as in the mockups.
export default async function SetupLayout({ children }: { children: React.ReactNode }) {
  await requireShell("parent");
  return children;
}
