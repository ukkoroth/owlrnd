import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumb";
import { PractiseButton } from "@/components/flashcards/Practise";
import { TrackTag } from "@/components/TrackTag";
import { PRACTISE_STATUSES, type CardState } from "@/domain/flashcards";
import { requireShell } from "@/server/auth/current";
import { deckPage } from "@/server/flashcards";

export const metadata: Metadata = { title: "Flashcards · owlrnd" };
export const dynamic = "force-dynamic";

const STATE: Record<CardState, { label: string; className: string }> = {
  to_practise: { label: "To practise", className: "bg-[#FDF2E3] text-[#7A4508]" },
  learning: { label: "Learning", className: "bg-pale text-sidebar" },
  known: { label: "Known", className: "bg-[#E3F1E0] text-[#22531C]" },
};

// fc-6: a track's deck, by topic, with what's due, what's being learnt and what's known. For the learner (both kinds).
export default async function DeckPage({ params }: { params: Promise<{ trackId: string }> }) {
  const { user: { student }, actor } = await requireShell("learner");
  const { trackId } = await params;
  const d = await deckPage(actor, trackId);
  if (!d) notFound();
  const tz = student.timeZone;
  const day = (x: Date) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: tz }).format(x).replace(",", "");
  const { total, due, known } = d.counts;

  return (
    <>
      <Breadcrumb items={[{ label: "Tracks", href: "/tracks" }, { label: d.trackName }, { label: "Flashcards" }]} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <TrackTag name={d.trackName} colorIndex={d.colorIndex} />
          <h1 className="mt-2 text-[32px] leading-tight">Flashcards</h1>
          <p className="mt-1 text-ink-muted">
            {total === 0
              ? "The cards for this track are being written."
              : `${total} ${total === 1 ? "card" : "cards"} · ${due} to practise today · ${known} known`}
          </p>
        </div>
        {PRACTISE_STATUSES.includes(d.status) && <PractiseButton trackId={d.trackId} trackName={d.trackName} deck={d.counts} from="tracks" className="h-12 px-6" />}
      </div>
      <p className="mt-3 max-w-[640px] text-sm text-ink-muted">
        Cards you get right come back less often; ones you&apos;re still learning come back the next day. A card is known once you&apos;ve got it 3 times in a row.
        Flashcards are practice: no marks, no effect on your goal.
      </p>

      <div className="mt-8 flex flex-col gap-8">
        {d.topics.map((t, i) => (
          <section key={t.name} aria-labelledby={`topic-${i}`}>
            <h2 id={`topic-${i}`} className="mb-2 flex items-baseline justify-between gap-3 text-lg">
              {t.name}
              <span className="text-sm font-normal text-ink-muted">
                {t.cards.length} {t.cards.length === 1 ? "card" : "cards"}
              </span>
            </h2>
            <ul className="divide-y divide-line rounded border border-line bg-card">
              {t.cards.map((c) => (
                <li key={c.id} className="flex flex-wrap items-start justify-between gap-x-5 gap-y-1.5 px-5 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block font-paper text-[17px]">{c.front}</span>
                    <span className="block text-sm text-ink-muted">
                      {c.answer}
                      {c.fromMissed && " · from a missed exam question"}
                    </span>
                  </span>
                  <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-bold ${STATE[c.state].className}`}>
                    {STATE[c.state].label}
                    {c.state === "learning" && ` · ${day(c.dueAt)}`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
