import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumb";
import { PageHeader } from "@/components/PageHeader";
import { requireShell } from "@/server/auth/current";
import { getOwnStudent } from "@/server/students";

export const metadata: Metadata = { title: "Set up practice · owlrnd" };

const Tick = () => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

// 2c: "Set up from scratch" is active; "Select from packages" is Coming soon (rules §2).
export default async function SetupChoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { actor } = await requireShell("parent");
  const { id } = await params;
  const student = await getOwnStudent(actor, id);
  if (!student) notFound();
  const name = student.name;

  return (
    <>
      <Breadcrumb items={[{ label: "Students", href: "/students" }, { label: name }, { label: "Set up" }]} />
      <div className="max-w-[720px]">
        <PageHeader title={`How would you like to set up ${name}'s practice?`} subtitle="You can add more tracks later, whichever way you choose." />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="card border-2 border-brand">
          <h2 className="text-2xl">Set up from scratch</h2>
          <p className="mt-1 text-ink-muted">
            Create {name}&apos;s tracks yourself. Chat with the AI and attach textbook pages, a syllabus photo or a short description, and it writes the exams.
          </p>
          <ul className="mt-4 flex flex-col gap-2">
            {["Any subject, any school board", `Exams built from ${name}'s own textbooks`, "Each exam adapts to the last result"].map((t) => (
              <li key={t} className="flex gap-2.5">
                <Tick />
                {t}
              </li>
            ))}
          </ul>
          <Link href={`/students/${student.id}/tracks`} className="btn-primary mt-5 h-[50px] w-full">
            Start setting up
          </Link>
        </section>
        <section className="card border-dashed border-line-input bg-transparent">
          <h2 className="flex flex-wrap items-center gap-3 text-2xl text-ink-muted">
            Select from packages
            <span className="rounded bg-pale px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-sidebar">Coming soon</span>
          </h2>
          <p className="mt-1 text-ink-muted">Ready-made packages for a school board and class, with every track loaded for you.</p>
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Packages coming soon">
            {["CBSE India", "ICSE India", "General knowledge", "Coaching", "Artificial intelligence"].map((t) => (
              <li key={t} className="rounded border border-line bg-card px-3 py-1.5 text-sm text-ink-muted">
                {t}
              </li>
            ))}
          </ul>
          <button type="button" disabled className="btn-outline mt-8 h-[50px] w-full">
            Coming soon
          </button>
        </section>
      </div>
    </>
  );
}
