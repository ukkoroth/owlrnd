import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/forms";
import { Avatar, PageHeader } from "@/components/PageHeader";
import { formatClass } from "@/domain/identity";
import { requireShell } from "@/server/auth/current";
import { listStudents } from "@/server/students";
import { lastExamSummary, practiceTimes } from "@/server/results";
import { ActivityCharts } from "@/components/charts/ActivityCharts";
import { flashcardActivity } from "@/server/flashcards";
import { cardsLine } from "@/domain/flashcards";
import { db } from "@/server/db";
import { tracks } from "@/server/db/schema";
import { and, count, inArray, ne } from "drizzle-orm";

export const metadata: Metadata = { title: "Your students · owlrnd" };

const PlusIcon = () => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

// 2k: the parent's home. Last exam, needs work (M4/M5) and the activity charts (M6) are added later.
export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ removed?: string }> }) {
  const { actor } = await requireShell("parent");
  const kids = await listStudents(actor);
  const { removed } = await searchParams;
  const trackCounts = kids.length
    ? await db
        .select({ studentId: tracks.studentId, n: count() })
        .from(tracks)
        .where(and(inArray(tracks.studentId, kids.map((k) => k.id)), ne(tracks.status, "draft")))
        .groupBy(tracks.studentId)
    : [];
  const tracksOf = (id: string) => trackCounts.find((t) => t.studentId === id)?.n ?? 0;
  const lastExams = new Map(await Promise.all(kids.map(async (k) => [k.id, await lastExamSummary(k.id)] as const)));
  const times = new Map(await Promise.all(kids.map(async (k) => [k.id, await practiceTimes(k.id)] as const)));
  const cards = new Map(await Promise.all(kids.map(async (k) => [k.id, await flashcardActivity(k.id)] as const)));

  return (
    <>
      <PageHeader
        title="Your students"
        subtitle="Each student has their own username, password and tracks."
        action={
          <Link href="/students/new" className="btn-primary h-12 px-6 text-base">
            <PlusIcon />
            Add student
          </Link>
        }
      />
      {removed && (
        <div className="mb-5">
          <Notice>{removed}&apos;s account has been removed.</Notice>
        </div>
      )}
      {kids.length === 0 ? (
        <div className="card max-w-xl">
          <h2 className="text-lg">Add your first student</h2>
          <p className="mt-1 text-ink-muted">Each child gets their own username and password. Then you set up what they practise.</p>
          <Link href="/students/new" className="btn-primary mt-4">
            Add student
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {kids.map((k) => (
            <li key={k.id} className="card flex flex-col">
              <div className="flex items-center gap-4">
                <Avatar name={k.name} size="lg" />
                <div className="min-w-0">
                  <h2 className="truncate text-2xl">{k.name}</h2>
                  <p className="truncate text-[15px] text-ink-muted">
                    {formatClass(k.className)} · username {k.username}
                  </p>
                </div>
              </div>
              {lastExams.get(k.id) ? (
                <div className="mt-5 border-b border-line pb-5 text-[16px] text-ink-muted">
                  <p>
                    Last exam: <strong className="text-ink">{lastExams.get(k.id)!.line}</strong>
                  </p>
                  <p>
                    Needs work: <span className="text-ink">{lastExams.get(k.id)!.needsWork || "nothing right now"}</span>
                  </p>
                </div>
              ) : (
                <p className="mt-5 border-b border-line pb-5 text-ink-muted">
                  {tracksOf(k.id) === 0
                    ? `No exams yet. Set up a track and the first exam appears on ${k.name}'s dashboard.`
                    : `No exams taken yet · ${tracksOf(k.id)} ${tracksOf(k.id) === 1 ? "track" : "tracks"}.`}
                </p>
              )}
              {/* fc-7: the child's flashcard practice, without card content. */}
              {cards.get(k.id)!.times.length > 0 && (
                <p className="border-b border-line py-3 text-[15px] text-ink-muted">
                  <strong className="text-ink">Flashcards:</strong> {cardsLine(cards.get(k.id)!.sessionsWeek, cards.get(k.id)!.known)}
                </p>
              )}
              {(times.get(k.id)?.length ?? 0) + cards.get(k.id)!.times.length > 0 && (
                <div className="border-b border-line py-5">
                  <ActivityCharts times={times.get(k.id)!} timeZone={k.timeZone} size="sm" flashcards={cards.get(k.id)!.times} />
                </div>
              )}
              <nav aria-label={`${k.name}`} className="mt-auto flex gap-6 pt-5 font-semibold">
                <Link href={`/students/${k.id}/tracks`} className="link min-h-touch content-center" aria-label={`Tracks for ${k.name}`}>
                  Tracks
                </Link>
                <Link href={`/students/${k.id}/setup`} className="link min-h-touch content-center" aria-label={`Set up ${k.name}'s practice`}>
                  Set up
                </Link>
                <Link href={`/students/${k.id}/edit`} className="link min-h-touch content-center" aria-label={`Edit ${k.name}`}>
                  Edit
                </Link>
              </nav>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
