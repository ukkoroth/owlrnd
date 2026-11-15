import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ExamsIcon, StudentsIcon } from "@/components/icons";
import { levelFor } from "@/domain/levels";

// Dev-only preview (also served when OWLRND_DEV_PAGES=1, for browser tests against a production build) of the signed-in shell with sample data (names from the mockups).
export const dynamic = "force-dynamic";

export default async function ShellPreview({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  if (process.env.NODE_ENV === "production" && process.env.OWLRND_DEV_PAGES !== "1") notFound();
  const { role } = await searchParams;

  if (role === "parent") {
    return (
      <AppShell user={{ name: "Atticus Finch", role: "parent" }} nav={[{ href: "/dev/shell?role=parent", label: "Students", icon: <StudentsIcon />, match: ["/dev/shell"] }]}>
        <h1 className="text-[32px] leading-tight">Your students</h1>
        <p className="mt-1 text-ink-muted">Each student has their own username, password and tracks.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="btn-primary">Primary</button>
          <button className="btn-outline">Outline</button>
          <button className="btn-danger">Danger</button>
          <button className="btn-outline" disabled>
            Disabled
          </button>
        </div>
      </AppShell>
    );
  }

  const total = 5_640;
  return (
    <AppShell
      user={{ name: "Scout", role: "student" }}
      nav={[{ href: "/dev/shell?role=student", label: "Exams", icon: <ExamsIcon />, match: ["/dev/shell"] }]}
      points={{ total, levelName: levelFor(total).current }}
    >
      <p className="text-sm text-ink-muted">Saturday, 14 November</p>
      <h1 className="text-[32px] leading-tight">Hi Scout</h1>
      <div className="card mt-8 max-w-md">
        <p className="font-paper text-[17px] text-paper-ink">1. Paper typeface sample: the resistance of a wire is 4 Ω.</p>
      </div>
      <div className="mt-6 flex gap-1" aria-label="Activity shades">
        {[0, 1, 2, 3, 4].map((n) => (
          <span key={n} className={`h-4 w-4 rounded bg-activity-${n}`} />
        ))}
      </div>
    </AppShell>
  );
}
