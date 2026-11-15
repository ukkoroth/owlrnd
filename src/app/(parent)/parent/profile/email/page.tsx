import { PageHeader } from "@/components/PageHeader";
import { requireParent } from "@/server/auth/current";
import { EmailForm } from "../ProfileForms";

export const metadata = { title: "Change email · owlrnd" };

export default async function ChangeEmailPage() {
  const { parent } = await requireParent();
  return (
    <div className="max-w-[480px]">
      <PageHeader
        title="Change your email"
        subtitle={
          <>
            Now: <strong className="text-ink">{parent.email}</strong>. We will send a code to the new address; the change takes effect once you enter it.
          </>
        }
      />
      <EmailForm />
    </div>
  );
}
