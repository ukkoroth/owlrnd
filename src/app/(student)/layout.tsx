import { AppShell } from "@/components/AppShell";
import { ExamsIcon } from "@/components/icons";
import { levelFor } from "@/domain/levels";
import { allowanceOf } from "@/server/ai/usage";
import { requireShell } from "@/server/auth/current";
import { loadLearner } from "@/server/learners";
import { pointsTotal } from "@/server/results";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { user: { student } } = await requireShell("learner");
  const total = await pointsTotal(student.id);
  // Only a self-managed learner holds their own AI allowance; a parent-managed learner's is their parent's.
  const holder = student.type === "self_managed" ? (await loadLearner(student.id))?.holder : undefined;
  const allowance = holder ? await allowanceOf(holder) : undefined;
  return (
    <AppShell
      // A self-managed learner is a "Learner"; a child a parent manages is a "Student" (sm-5a, editions §2.7).
      user={{ name: student.name, role: "student", roleLabel: student.type === "self_managed" ? "Learner" : "Student" }}
      nav={[{ href: "/today", label: "Exams", icon: <ExamsIcon />, match: ["/profile", "/tracks", "/exam"] }]}
      points={{ total, levelName: levelFor(total).current, href: "/points" }}
      allowance={allowance}
    >
      {children}
    </AppShell>
  );
}
