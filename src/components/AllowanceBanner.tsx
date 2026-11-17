import Link from "next/link";
import type { AllowanceState } from "@/domain/allowance";
import type { HoldViewer } from "@/domain/examHold";

/**
 * Shown at the top of every signed-in page while the account's AI allowance is used up (owner, 2026-11-17), so
 * nobody is left wondering why no new exam arrives. The account holder (a parent or a self-managed learner) is told
 * how to carry on; a parent-managed child is told to ask their parent. Exams already written can still be taken and
 * are always marked; flashcards already made can still be practised.
 */
export function AllowanceBanner({ allowance, viewer }: { allowance: AllowanceState | undefined; viewer: HoldViewer }) {
  if (!allowance?.usedUp) return null;
  return (
    <div role="status" className="mb-6 rounded border border-[#F5C76B] border-l-4 border-l-[#E0A21B] bg-[#FFF7E3] px-5 py-3.5 text-ink">
      {viewer === "holder" ? (
        <>
          <p>
            <strong>Your AI allowance is used up.</strong> New exams and flashcards are on hold, and track chats are paused.
            Exams already written can still be taken and are always marked.
          </p>
          <Link href="/contact?topic=package" className="link flex min-h-touch items-center font-semibold">
            Contact us to buy a package
          </Link>
        </>
      ) : (
        <p>
          <strong>New exams are on hold.</strong> Your parent&apos;s AI allowance is used up, so ask them to top it up. You can still
          take exams that are ready and practise your flashcards.
        </p>
      )}
    </div>
  );
}
