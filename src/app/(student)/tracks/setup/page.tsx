import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { TrySample } from "@/components/tracks/TrySample";
import { can } from "@/domain/permissions";
import { requireShell } from "@/server/auth/current";

export const metadata: Metadata = { title: "Which exam are you preparing for? · owlrnd" };

/** The same eight packages as the landing page; none is live in 0.2 (owner, 2026-11-15). */
const PACKAGES = [
  ["JEE Main", "Physics, Chemistry, Mathematics"],
  ["NEET UG", "Physics, Chemistry, Biology"],
  ["CUET UG", "Domain subjects and the general test"],
  ["CAT", "Quant, verbal, data interpretation and reasoning"],
  ["GATE", "Your engineering branch, maths and aptitude"],
  ["UPSC Prelims", "General studies and CSAT"],
  ["SSC CGL", "Quant, reasoning, English, general awareness"],
  ["Bank PO", "Quant, reasoning, English, banking awareness"],
];

// sm-2a. In 0.2 Build your own is its own section at the top; the packages sit below, Coming soon (owner, 2026-11-15).
export default async function ChooseExamPage() {
  const { user: { student }, actor } = await requireShell("learner");
  if (!can(actor, "manageTracks", student)) notFound();

  return (
    <div className="max-w-[940px]">
      <p className="text-sm font-semibold text-brand">Welcome, {student.name}</p>
      <PageHeader title="Which exam are you preparing for?" subtitle="Build your own track now. Ready-made packages for each exam are coming soon." />

      <section aria-labelledby="build" className="card flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-2 border-brand">
        <div className="min-w-0 flex-[1_1_380px]">
          <h2 id="build" className="text-2xl">
            Build your own
          </h2>
          <p className="mt-1 text-ink-muted">Any exam, any topic. Chat with the AI and attach your syllabus, notes or a past paper.</p>
        </div>
        <Link href="/tracks/new" className="btn-primary h-[52px] px-6">
          Build your own track
        </Link>
      </section>

      <section aria-labelledby="sample" className="card mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 flex-[1_1_380px]">
          <h2 id="sample" className="text-xl">
            Or try a sample track first
          </h2>
          <p className="mt-1 text-ink-muted">The Solar System: see how owlrnd works with an exam that&apos;s ready straight away. No setup; delete it whenever you like.</p>
        </div>
        <TrySample studentId={student.id} />
      </section>

      <section aria-labelledby="packages" className="mt-10">
        <h2 id="packages" className="flex flex-wrap items-center gap-3 text-xl">
          Ready-made packages
          <span className="rounded bg-pale px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-sidebar">Coming soon</span>
        </h2>
        <ul className="mt-4 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4" aria-label="Packages coming soon">
          {PACKAGES.map(([name, line]) => (
            <li key={name} className="rounded border border-dashed border-line-input bg-transparent px-4 py-4">
              <h3 className="text-lg text-ink-muted">{name}</h3>
              <p className="mt-1 text-sm text-ink-muted">{line}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
