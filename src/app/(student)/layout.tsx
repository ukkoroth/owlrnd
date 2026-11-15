import { AppShell } from "@/components/AppShell";
import { ExamsIcon } from "@/components/icons";
import { levelFor } from "@/domain/levels";
import { requireStudent } from "@/server/auth/current";
import { pointsTotal } from "@/server/results";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { student } = await requireStudent();
  const total = await pointsTotal(student.id);
  return (
    <AppShell
      user={{ name: student.name, role: "student" }}
      nav={[{ href: "/today", label: "Exams", icon: <ExamsIcon />, match: ["/profile", "/tracks", "/exam"] }]}
      points={{ total, levelName: levelFor(total).current, href: "/points" }}
    >
      {children}
    </AppShell>
  );
}
