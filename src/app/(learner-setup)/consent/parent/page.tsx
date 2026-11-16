import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthHeading, AuthLayout, LEARNER_STEPS } from "@/components/AuthLayout";
import { rules } from "@/config/rules";
import { getLearnerConsent } from "@/server/auth/current";
import { AskParentForm } from "./AskParentForm";

export const metadata: Metadata = { title: "Ask a parent to agree · owlrnd" };

// sm-1d (and Change email from the sm-1e banner). Only for an under-18 learner whose parent hasn't agreed.
export default async function AskParentPage() {
  const consent = await getLearnerConsent();
  if (!consent || consent.state === "not_needed" || consent.state === "agreed") redirect("/today");
  const blocking = rules.consent.under18Mode === "block_until_consent";

  return (
    <AuthLayout
      variant="steps"
      steps={LEARNER_STEPS}
      headline={
        <>
          Tell us who
          <br />
          your parent is.
        </>
      }
    >
      <AuthHeading title="Ask a parent to agree">
        You are under 18, so we need a parent or guardian to agree.{" "}
        {blocking ? "You can start practising as soon as they do." : "You can start practising straight away while we ask them."} They will{" "}
        <strong className="text-ink">not</strong> control your tracks or see your answers.
      </AuthHeading>
      <AskParentForm name={consent.latest?.parentName} email={consent.latest?.parentEmail} />
    </AuthLayout>
  );
}
