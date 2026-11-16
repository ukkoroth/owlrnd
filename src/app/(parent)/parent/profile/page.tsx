import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/forms";
import { PageHeader, SectionLabel } from "@/components/PageHeader";
import { formatClass } from "@/domain/identity";
import { requireShell } from "@/server/auth/current";
import { db } from "@/server/db";
import { students } from "@/server/db/schema";

export const metadata: Metadata = { title: "Your profile · owlrnd" };

const UPDATED: Record<string, string> = {
  name: "Your name has been updated.",
  email: "Your email has been changed. Sign-in codes now go to the new address.",
  password: "Your password has been changed. Other devices have been signed out.",
};

// 5d
export default async function ParentProfilePage({ searchParams }: { searchParams: Promise<{ updated?: string }> }) {
  const { user: { parent } } = await requireShell("parent");
  const { updated } = await searchParams;
  const kids = await db.select().from(students).where(eq(students.parentId, parent.id)).orderBy(asc(students.createdAt));

  return (
    <>
      <PageHeader title="Your profile" subtitle="Parent account" />
      {updated && UPDATED[updated] && (
        <div className="mb-5">
          <Notice>{UPDATED[updated]}</Notice>
        </div>
      )}
      <div className="grid items-start gap-4 md:grid-cols-2">
        <section className="card">
          <SectionLabel>Details</SectionLabel>
          <dl className="divide-y divide-line">
            <Row label="Name" value={parent.name} href="/parent/profile/name" action="Edit" />
            <Row label="Email" value={parent.email} href="/parent/profile/email" action="Change" />
            <Row label="Password" value="••••••••••" href="/parent/profile/password" action="Change" />
          </dl>
          <p className="border-t border-line pt-4 text-sm text-ink-muted">
            Changing your email needs a code sent to the new address. Sign-in codes for you and your children go to this email.
          </p>
        </section>
        <section className="card">
          <SectionLabel>Students</SectionLabel>
          {kids.length ? (
            <dl className="divide-y divide-line border-b border-line">
              {kids.map((k) => (
                <Row key={k.id} label={k.name} value={`${formatClass(k.className)} · ${k.username}`} href={`/students/${k.id}/edit`} action="Edit" ariaLabel={`Edit ${k.name}`} />
              ))}
            </dl>
          ) : (
            <p className="text-ink-muted">No students yet.</p>
          )}
          <Link href="/students/new" className="btn-outline mt-4 w-full">
            Add a student
          </Link>
        </section>
      </div>
      <div className="mt-6 flex items-center justify-between border-t border-line pt-5">
        <form action="/api/auth/sign-out" method="post">
          <button className="btn-outline">Sign out</button>
        </form>
        <Link href="/parent/profile/delete" className="text-sm font-semibold text-danger-text underline underline-offset-2">
          Delete my account
        </Link>
      </div>
    </>
  );
}

function Row({ label, value, href, action, ariaLabel }: { label: string; value: string; href?: string; action?: string; ariaLabel?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 first:pt-0">
      <div className="min-w-0">
        <dt className="text-[13px] text-ink-muted">{label}</dt>
        <dd className="truncate font-semibold">{value}</dd>
      </div>
      {href && action && (
        <Link href={href} className="link flex min-h-touch items-center font-semibold" aria-label={ariaLabel ?? `${action} ${label.toLowerCase()}`}>
          {action}
        </Link>
      )}
    </div>
  );
}
