import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/forms";
import { Avatar, PageHeader, SectionLabel } from "@/components/PageHeader";
import { formatClass } from "@/domain/identity";
import { levelFor } from "@/domain/levels";
import { requireShell } from "@/server/auth/current";
import { pointsTotal } from "@/server/results";

export const metadata: Metadata = { title: "Your profile · owlrnd" };

const UPDATED: Record<string, string> = {
  name: "Your name has been updated.",
  email: "Your email has been changed. Sign-in codes now go to the new address.",
  password: "Your password has been changed. Other devices have been signed out.",
};

// 5b. A self-managed learner changes their own name, email and password and can delete their account (sm-5b);
// for a child, it is read-only and their parent manages the password.
export default async function StudentProfilePage({ searchParams }: { searchParams: Promise<{ updated?: string }> }) {
  const { user: { student } } = await requireShell("learner");
  const total = await pointsTotal(student.id);
  const level = levelFor(total).current;
  const points = `${total.toLocaleString("en-GB")}${level ? ` · ${level} level` : ""}`;
  const selfManaged = student.type === "self_managed";
  const { updated } = await searchParams;

  return (
    <div className="max-w-[720px]">
      <PageHeader title="Your profile" />
      {selfManaged && updated && UPDATED[updated] && (
        <div className="mb-5">
          <Notice>{UPDATED[updated]}</Notice>
        </div>
      )}
      <div className="mb-6 flex items-center gap-4">
        <Avatar name={student.name} size="lg" />
        <div>
          <p className="text-2xl font-semibold">{student.name}</p>
          <p className="text-ink-muted">{selfManaged ? "Learner" : formatClass(student.className)}</p>
        </div>
      </div>
      <section className="card">
        <SectionLabel>Your account</SectionLabel>
        {selfManaged ? (
          <>
            <dl className="divide-y divide-line">
              <Row label="Name" value={student.name} href="/profile/name" action="Edit" />
              <Row label="Email" value={student.email ?? ""} href="/profile/email" action="Change" />
              <Row label="Password" value="••••••••" href="/profile/password" action="Change" />
              <Row label="Points" value={points} href="/points" action="See points" />
            </dl>
            <p className="mt-4 border-t border-line pt-4 text-sm text-ink-muted">
              Each sign-in sends a 6-digit code to this email. You can change your email or password at any time.
            </p>
          </>
        ) : (
          <>
            <dl className="divide-y divide-line">
              <Row label="Username" value={student.username ?? ""} />
              <Row label="Password" value="••••••••" />
              <Row label="Points" value={points} />
            </dl>
            <p className="mt-4 border-t border-line pt-4 text-sm text-ink-muted">
              Your parent manages your password. Ask them if you need to change it, or use &quot;Forgot password&quot; on the sign-in page.
            </p>
          </>
        )}
      </section>
      <div className="mt-6 flex items-center justify-between">
        <form action="/api/auth/sign-out" method="post">
          <button className="btn-outline">Sign out</button>
        </form>
        {selfManaged && (
          <Link href="/profile/delete" className="text-sm font-semibold text-danger-text underline underline-offset-2">
            Delete my account
          </Link>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, href, action }: { label: string; value: string; href?: string; action?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0">
      <div className="min-w-0">
        <dt className="text-[13px] text-ink-muted">{label}</dt>
        <dd className="truncate font-semibold">{value}</dd>
      </div>
      {href && action && (
        <Link href={href} className="link flex min-h-touch items-center font-semibold" aria-label={action === "See points" ? "See points" : `${action} ${label.toLowerCase()}`}>
          {action}
        </Link>
      )}
    </div>
  );
}
