import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FlashcardSession } from "@/components/flashcards/FlashcardSession";
import { requirePractice } from "@/server/auth/current";
import { startSession } from "@/server/flashcards";

export const metadata: Metadata = { title: "Flashcards · owlrnd" };
export const dynamic = "force-dynamic";

// fc-2 to fc-4. Opening the page starts a session on the track's deck; ?again=<session> repeats its "Not yet" cards.
export default async function PractisePage({ params, searchParams }: { params: Promise<{ trackId: string }>; searchParams: Promise<{ again?: string; from?: string }> }) {
  const { actor } = await requirePractice();
  const { trackId } = await params;
  const { again, from } = await searchParams;
  const session = await startSession(actor, trackId, { again });
  if (!session) notFound();
  // Back to where the learner came from: the dashboard (default) or Your tracks.
  const back = from === "tracks" ? "/tracks" : "/today";

  if (!session.cards.length) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="card max-w-md text-center">
          <h1 className="text-2xl">No flashcards yet</h1>
          <p className="mt-2 text-ink-muted">This track&apos;s cards are still being written. They&apos;ll be ready in a minute or two.</p>
          <Link href={back} className="btn-primary mt-5 inline-flex h-12 px-6">
            Back
          </Link>
        </div>
      </main>
    );
  }
  return <FlashcardSession key={session.sessionId} session={session} back={back} />;
}
