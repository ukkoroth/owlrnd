import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Landing } from "@/components/landing/Landing";
import { getCurrentUser, homeFor } from "@/server/auth/current";

// Landing hand-off of 2026-11-16, docs/03-behaviour.md (Metadata).
const title = "owlrnd: rank-ready, every day";
const description =
  "Pick your exam, attach the syllabus or your notes, and owlrnd writes exam-style tests for you, marks them, and builds every new test from what you got wrong on the last one.";
const image = { url: "/brand/owlrnd-og-image-1200x630.png", width: 1200, height: 630, alt: "owlrnd: rank-ready, every day" };

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: "website", siteName: "owlrnd", images: [image] },
  twitter: { card: "summary_large_image", title, description, images: [image.url] },
};

/** Public landing page. Signed-in parents and students go straight to their home instead. */
export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user));
  return <Landing />;
}
