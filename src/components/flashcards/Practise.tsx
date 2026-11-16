import Link from "next/link";
import type { DeckCount } from "@/server/flashcards";

const plural = (n: number, fresh = false) => `${n} ${fresh ? "new " : ""}${n === 1 ? "flashcard" : "flashcards"}`;

/**
 * "Practise · N flashcards" (fc-1, fc-5): opens a session on the track. With none due it says "N new flashcards" (a
 * top-up is written first). Nothing when there is nothing to practise.
 */
export function PractiseButton({ trackId, trackName, deck, from, className = "" }: { trackId: string; trackName: string; deck: DeckCount | undefined; from?: "tracks"; className?: string }) {
  if (!deck?.practise) return null;
  const label = plural(deck.practise, deck.due === 0);
  return (
    <Link href={`/practise/${trackId}${from ? `?from=${from}` : ""}`} className={`btn-practise ${className}`} aria-label={`Practise ${label}: ${trackName}`}>
      Practise · {label}
    </Link>
  );
}

const ago = (d: Date, now: Date, timeZone: string) => {
  const day = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone }).format(x);
  const days = Math.round((Date.parse(day(now)) - Date.parse(day(d))) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : days < 7 ? `${days} days ago` : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone }).format(d);
};

/** The deck line on a track card (fc-5): "Flashcards · 24 cards · 8 to practise today", and when last practised. */
export function DeckLine({ deck, timeZone, reached }: { deck: DeckCount | undefined; timeZone: string; reached?: boolean }) {
  if (!deck) return null;
  const now = new Date();
  return (
    <p className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded bg-page px-3.5 py-3 text-sm">
      <span>
        <strong>Flashcards</strong> ·{" "}
        {deck.total === 0 ? "being written" : `${deck.total} ${deck.total === 1 ? "card" : "cards"} · ${deck.due ? `${deck.due} to practise today` : "none due today"}`}
      </span>
      <span className="text-ink-muted">{deck.lastAt ? `Last: ${ago(deck.lastAt, now, timeZone)}` : reached ? "Keeps it fresh" : ""}</span>
    </p>
  );
}
