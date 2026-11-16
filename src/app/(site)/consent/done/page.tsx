import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading, AuthLayout } from "@/components/AuthLayout";

export const metadata: Metadata = { title: "Thank you · owlrnd", robots: { index: false } };

// After the parent answers on sm-1f.
export default async function ConsentDonePage({ searchParams }: { searchParams: Promise<{ answer?: string }> }) {
  const { answer } = await searchParams;
  const agreed = answer === "agreed";
  return (
    <AuthLayout variant="tagline">
      <div role="status">
        <AuthHeading title={agreed ? "Thank you, you've agreed" : "You've declined"}>
          {agreed
            ? "We've let them know. They can keep practising, and you can withdraw your consent at any time by contacting us."
            : "Their owlrnd account has been closed and its data deleted. We've let them know."}
        </AuthHeading>
      </div>
      <Link href="/" className="btn-outline">
        Go to owlrnd.com
      </Link>
    </AuthLayout>
  );
}
