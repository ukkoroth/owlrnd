import { AppShell } from "@/components/AppShell";
import { StudentsIcon } from "@/components/icons";
import { requireParent } from "@/server/auth/current";

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const { parent } = await requireParent();
  return (
    <AppShell user={{ name: parent.name, role: "parent" }} nav={[{ href: "/students", label: "Students", icon: <StudentsIcon />, match: ["/parent"] }]}>
      {children}
    </AppShell>
  );
}
