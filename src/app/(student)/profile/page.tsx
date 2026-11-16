import type { Metadata } from "next";
import { Avatar, PageHeader, SectionLabel } from "@/components/PageHeader";
import { formatClass } from "@/domain/identity";
import { levelFor } from "@/domain/levels";
import { requireShell } from "@/server/auth/current";
import { pointsTotal } from "@/server/results";

export const metadata: Metadata = { title: "Your profile · owlrnd" };

// 5b: read-only for the student.
export default async function StudentProfilePage() {
  const { user: { student } } = await requireShell("learner");
  const total = await pointsTotal(student.id);
  const level = levelFor(total).current;

  return (
    <div className="max-w-[720px]">
      <PageHeader title="Your profile" />
      <div className="mb-6 flex items-center gap-4">
        <Avatar name={student.name} size="lg" />
        <div>
          <p className="text-2xl font-semibold">{student.name}</p>
          <p className="text-ink-muted">{formatClass(student.className)}</p>
        </div>
      </div>
      <section className="card">
        <SectionLabel>Your account</SectionLabel>
        <dl className="divide-y divide-line">
          {/* Parent-managed learners sign in with a username, self-managed learners with their email. */}
          <Row label={student.username ? "Username" : "Email"} value={student.username ?? student.email ?? ""} />
          <Row label="Password" value="••••••••" />
          <Row label="Points" value={`${total.toLocaleString("en-GB")}${level ? ` · ${level} level` : ""}`} />
        </dl>
        <p className="mt-4 border-t border-line pt-4 text-sm text-ink-muted">
          Your parent manages your password. Ask them if you need to change it, or use &quot;Forgot password&quot; on the sign-in page.
        </p>
      </section>
      <form action="/api/auth/sign-out" method="post" className="mt-6">
        <button className="btn-outline">Sign out</button>
      </form>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-3 first:pt-0">
      <dt className="text-[13px] text-ink-muted">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
