import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Landing } from "@/components/landing/Landing";
import { getCurrentUser, homeFor } from "@/server/auth/current";

const title = "owlrnd: exam-ready, every day";
const description =
  "owlrnd writes short, paper-style exams for your child from their textbook, marks them, and builds every new exam from how they did on the last one.";

// A share image is not designed yet; add `images` to openGraph and twitter when it is.
export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: "website", siteName: "owlrnd" },
  twitter: { card: "summary", title, description },
};

/** Public landing page. Signed-in parents and students go straight to their home instead. */
export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user));
  return <Landing />;
}
