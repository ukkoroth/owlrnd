import { EditNameView } from "@/components/profile/ProfileViews";
import { requireShell } from "@/server/auth/current";

export const metadata = { title: "Edit name · owlrnd" };

export default async function EditNamePage() {
  const { user: { parent } } = await requireShell("parent");
  return <EditNameView name={parent.name} base="/parent/profile" />;
}
