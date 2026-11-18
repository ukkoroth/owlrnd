import Link from "next/link";
import { Notice } from "@/components/forms";
import { PageHeader } from "@/components/PageHeader";
import { TrackCard } from "@/components/TrackCard";
import { DeleteTrackButton, RestoreButton } from "@/components/ArchiveButton";
import { newTrackHref, trackHref, trackWords, type TrackAudience } from "@/domain/trackView";
import type { TrackSummary } from "@/server/tracks";
import type { DeckCount } from "@/server/flashcards";

const Plus = () => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

type Props = {
  audience: TrackAudience;
  list: TrackSummary[];
  /** A track chat is in progress (a draft). */
  hasDraft: boolean;
  /** Just created a track (?created=1). */
  created: boolean;
  timeZone: string;
  /** Flashcard decks (0.3, fc-5), for a learner practising here. */
  decks?: Map<string, DeckCount>;
  /** A child's flashcard practice per track, for the parent's line (fc-7). */
  cardsActivity?: Map<string, { sessionsWeek: number; known: number; total: number }>;
};

/**
 * The tracks page: the parent's 2d (none yet) / 2g, and the learner's sm-2c / sm-4.1a "Your tracks: practise and
 * manage". The same cards and actions; links and words follow the audience.
 */
export function TracksOverview({ audience, list, hasDraft, created, timeZone, decks, cardsActivity }: Props) {
  const words = trackWords(audience);
  const learner = audience.kind === "learner";
  const newHref = newTrackHref(audience);
  const subject = audience.kind === "parent" ? audience.studentName : "you";
  // Archived tracks (roadmap 22) are listed apart; with only archived tracks the page shows the empty state too.
  const live = list.filter((t) => t.status !== "archived");
  const archived = list.filter((t) => t.status === "archived");
  const studentId = audience.kind === "parent" ? audience.studentId : list[0]?.studentId;

  return (
    <>
      <PageHeader
        title={words.tracksTitle}
        subtitle={
          <span className="block max-w-[640px]">
            {learner
              ? "Each new exam is built from your last result in that track."
              : `A track is a series of short exams on one topic or one upcoming test. Each new exam in a track is built from ${subject}'s last result.`}
          </span>
        }
        action={
          live.length > 0 && (
            <Link href={newHref} className="btn-primary h-12 px-6 text-base">
              <Plus />
              New track
            </Link>
          )
        }
      />

      {hasDraft && !created && (
        <div className="mb-5">
          <Notice>
            You have a track in progress.{" "}
            <Link href={newHref} className="link font-semibold">
              Continue the chat
            </Link>
          </Notice>
        </div>
      )}

      {live.length === 0 ? (
        <section className="grid gap-8 rounded border border-dashed border-line-input bg-card p-9 md:grid-cols-2">
          <div>
            <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full bg-pale text-sidebar">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="4" y="13" width="4" height="7" />
                <rect x="10" y="9" width="4" height="11" />
                <rect x="16" y="4" width="4" height="16" />
              </svg>
            </span>
            <h2 className="mt-4 text-2xl">No tracks yet</h2>
            <p className="mt-2 text-ink-muted">
              {learner ? (
                <>
                  Create your first track and your first exam appears on your dashboard straight away. For example, &quot;JEE Physics: Current
                  electricity&quot; or &quot;CAT: Quantitative ability&quot;.
                </>
              ) : (
                <>
                  Create {subject}&apos;s first track and the first exam appears on {subject}&apos;s dashboard straight away. For example, &quot;Physics:
                  Current electricity&quot; or &quot;Maths unit test on 20 Nov&quot;.
                </>
              )}
            </p>
            <Link href={newHref} className="btn-primary mt-5 h-[52px] px-6">
              <Plus />
              Create the first track
            </Link>
          </div>
          <div>
            <h3 className="mb-4 text-[15px] font-semibold uppercase tracking-wider text-ink-muted">How it works</h3>
            <ol className="flex flex-col gap-4">
              {[
                ["Describe it", learner ? "Tell the AI the exam, the subject or chapter, and your exam date." : "Tell the AI the subject, chapter or test and when it is."],
                ["Attach material", learner ? "Add your syllabus, your notes or a past paper, or just a short description." : "Add photos of textbook pages, a syllabus, or just a short description."],
                [
                  "The AI builds it",
                  `It finds the topics, sets a goal with you and writes exams of up to 10 questions. When the goal is reached the track stops until you add topics.`,
                ],
              ].map(([title, body], i) => (
                <li key={title} className="flex gap-4">
                  <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pale text-sm font-semibold text-sidebar">
                    {i + 1}
                  </span>
                  <span>
                    <strong className="block">{title}</strong>
                    <span className="text-[15px] text-ink-muted">{body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : (
        <>
          {created && (
            <div className="mb-5 flex items-center gap-3 rounded border border-line bg-card px-5 py-4" role="status">
              <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-white">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              </span>
              <p>
                <strong>{live.length === 1 ? "First track created." : "Track created."}</strong> {words.firstExamWhere}
              </p>
            </div>
          )}
          {live
            .filter((t) => t.status === "goal_reached")
            .map((t) => (
              <div key={t.id} className="mb-5 rounded border border-line bg-card px-5 py-4" role="status">
                <strong>Goal reached on {t.name}.</strong> The track has stopped. Add topics to set a new goal.
              </div>
            ))}
          <div className={`grid gap-4 ${learner ? "md:grid-cols-2 xl:grid-cols-3" : "md:grid-cols-2"}`}>
            {live
              // A track that just reached its goal comes first (2i).
              .sort((a, b) => Number(b.status === "goal_reached") - Number(a.status === "goal_reached"))
              .map((t, i) => (
                <TrackCard key={t.id} track={t} highlight={created && i === 0} audience={audience} timeZone={timeZone} deck={decks?.get(t.id)} cardsActivity={cardsActivity?.get(t.id)} />
              ))}
          </div>
          {learner && <p className="mt-6 text-sm text-ink-muted">A track stops when its goal is reached, until you add topics.</p>}
        </>
      )}
      {archived.length > 0 && studentId && (
        <details className="mt-8">
          <summary className="min-h-touch cursor-pointer content-center font-semibold">Archived tracks ({archived.length})</summary>
          <ul className="mt-3 divide-y divide-line rounded border border-line bg-card">
            {archived.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-x-5 gap-y-1 px-5 py-3">
                <span>
                  <span className="font-semibold">{t.name}</span>
                  <span className="block text-sm text-ink-muted">
                    {t.examsTaken} {t.examsTaken === 1 ? "exam" : "exams"}
                    {audience.kind === "parent" ? ` · hidden from ${audience.studentName}` : ""}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-x-5">
                  {t.examsTaken > 0 && (
                    <Link href={trackHref(audience, t.id)} className="link flex min-h-touch items-center text-sm font-semibold" aria-label={`Exam history of ${t.name}`}>
                      Exam history
                    </Link>
                  )}
                  <RestoreButton trackId={t.id} studentId={studentId} trackName={t.name ?? ""} />
                  <DeleteTrackButton trackId={t.id} studentId={studentId} trackName={t.name ?? ""} />
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
