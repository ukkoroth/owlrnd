import { PageHeader } from "@/components/PageHeader";
import { requireParent } from "@/server/auth/current";
import { NameForm } from "../ProfileForms";

export const metadata = { title: "Edit name · owlrnd" };

export default async function EditNamePage() {
  const { parent } = await requireParent();
  return (
    <div className="max-w-[480px]">
      <PageHeader title="Edit your name" />
      <NameForm name={parent.name} />
    </div>
  );
}
