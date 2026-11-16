import Link from "next/link";
import { resendToParent } from "@/app/_actions/consent";
import { rules } from "@/config/rules";
import { maskEmail } from "@/domain/codes";
import type { LearnerConsent } from "@/server/consent";

/**
 * sm-1e: shown to an under-18 learner until their parent agrees. Practice carries on while pending (owner's
 * default); after 30 days without an answer, or in "block until consent", it says practice is paused.
 */
export function ConsentBanner({ consent, timeZone }: { consent: LearnerConsent; timeZone: string }) {
  const { state, latest } = consent;
  if (state === "not_needed" || state === "agreed" || state === "declined") return null;
  const blocked = !consent.practiseAllowed;
  const sentOn = latest ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone }).format(latest.createdAt) : null;

  return (
    <div role="status" className="mb-6 rounded border border-[#F5C76B] border-l-4 border-l-[#E0A21B] bg-[#FFF7E3] px-5 py-3.5 text-ink">
      <p>
        <strong>{!latest ? "Ask a parent to agree." : blocked ? "Practice is paused until your parent agrees." : "Waiting for your parent to agree."}</strong>{" "}
        {latest
          ? `We emailed ${maskEmail(latest.parentEmail)} on ${sentOn}. `
          : "You are under 18, so a parent or guardian needs to agree. "}
        {!blocked
          ? "You can keep practising meanwhile."
          : state === "overdue"
            ? `They haven't answered in ${rules.consent.pauseAfterDays} days. Send them a new link.`
            : "You can start practising as soon as they do."}
      </p>
      <div className="mt-1 flex flex-wrap gap-x-5">
        {latest && (
          <form action={resendToParent}>
            <button className="link min-h-touch font-semibold">Resend</button>
          </form>
        )}
        <Link href="/consent/parent" className="link flex min-h-touch items-center font-semibold">
          {latest ? "Change email" : "Ask a parent"}
        </Link>
      </div>
    </div>
  );
}
