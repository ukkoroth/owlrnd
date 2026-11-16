import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Notice } from "@/components/forms";
import { PageHeader } from "@/components/PageHeader";
import { TrackCard } from "@/components/TrackCard";
import { requireShell } from "@/server/auth/current";
import { getOwnStudent } from "@/server/students";
import { getDraftChat, listTracks } from "@/server/tracks";

export const metadata: Metadata = { title: "Tracks · owlrnd" };
export const dynamic = "force-dynamic";

const Plus = () => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

// 2d (none yet) and 2g (with tracks).
export default async function TracksPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { actor } = await requireShell("parent");
  const { id } = await params;
  const student = await getOwnStudent(actor, id);
  if (!student) notFound();
  const list = (await listTracks(actor, id)) ?? [];
  const draft = (await getDraftChat(actor, id))?.draft;
  const { created } = await searchParams;
  const name = student.name;
  const newHref = `/students/${id}/tracks/new`;

  return (
    <>
      <Breadcrumb items={[{ label: "Students", href: "/students" }, { label: name }, { label: "Tracks" }]} />
      <PageHeader
        title={`${name}'s tracks`}
        subtitle={<span className="block max-w-[640px]">A track is a series of short exams on one topic or one upcoming test. Each new exam in a track is built from {name}&apos;s last result.</span>}
        action={
          list.length > 0 && (
            <Link href={newHref} className="btn-primary h-12 px-6 text-base">
              <Plus />
              New track
            </Link>
          )
        }
      />

      {draft && !created && (
        <div className="mb-5">
          <Notice>
            You have a track in progress.{" "}
            <Link href={newHref} className="link font-semibold">
              Continue the chat
            </Link>
          </Notice>
        </div>
      )}

      {list.length === 0 ? (
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
              Create {name}&apos;s first track and the first exam appears on {name}&apos;s dashboard straight away. For example, &quot;Physics: Current
              electricity&quot; or &quot;Maths unit test on 20 Nov&quot;.
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
                ["Describe it", "Tell the AI the subject, chapter or test and when it is."],
                ["Attach material", "Add photos of textbook pages, a syllabus, or just a short description."],
                [
                  "The AI builds it",
                  "It finds the topics, sets a goal with you and writes exams of up to 10 questions. When the goal is reached the track stops until you add topics.",
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
                <strong>{list.length === 1 ? "First track created." : "Track created."}</strong> {name} will see its first exam on their dashboard the next time they sign in.
              </p>
            </div>
          )}
          {list
            .filter((t) => t.status === "goal_reached")
            .map((t) => (
              <div key={t.id} className="mb-5 rounded border border-line bg-card px-5 py-4" role="status">
                <strong>Goal reached on {t.name}.</strong> The track has stopped. Add topics to set a new goal.
              </div>
            ))}
          <div className="grid gap-4 md:grid-cols-2">
            {list
              .filter((t) => t.status !== "archived")
              // A track that just reached its goal comes first (2i).
              .sort((a, b) => Number(b.status === "goal_reached") - Number(a.status === "goal_reached"))
              .map((t, i) => (
                <TrackCard key={t.id} track={t} highlight={!!created && i === 0} studentName={name} timeZone={student.timeZone} />
              ))}
          </div>
          {list.some((t) => t.status === "archived") && (
            <details className="mt-8">
              <summary className="min-h-touch cursor-pointer content-center font-semibold">Archived tracks ({list.filter((t) => t.status === "archived").length})</summary>
              <ul className="mt-3 divide-y divide-line rounded border border-line bg-card">
                {list
                  .filter((t) => t.status === "archived")
                  .map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                      <span>
                        <span className="font-semibold">{t.name}</span>
                        <span className="block text-sm text-ink-muted">
                          {t.examsTaken} {t.examsTaken === 1 ? "exam" : "exams"} · hidden from {name}
                        </span>
                      </span>
                      <Link href={`/students/${id}/tracks/${t.id}`} className="link font-semibold">
                        Exam history
                      </Link>
                    </li>
                  ))}
              </ul>
            </details>
          )}
        </>
      )}
    </>
  );
}
