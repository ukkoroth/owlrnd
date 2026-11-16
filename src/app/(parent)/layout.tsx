import { AppShell } from "@/components/AppShell";
import { StudentsIcon } from "@/components/icons";
import { holderForParent } from "@/domain/accounts";
import { allowanceOf } from "@/server/ai/usage";
import { requireShell } from "@/server/auth/current";

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const { user: { parent } } = await requireShell("parent");
  const allowance = await allowanceOf(holderForParent(parent));
  return (
    <AppShell user={{ name: parent.name, role: "parent" }} allowance={allowance} nav={[{ href: "/students", label: "Students", icon: <StudentsIcon />, match: ["/parent"] }]}>
      {children}
    </AppShell>
  );
}
