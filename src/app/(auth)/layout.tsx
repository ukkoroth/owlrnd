import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/server/auth/current";

// Signed-out screens. Someone already signed in goes to their home instead.
export default async function AuthGroupLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user));
  return children;
}
