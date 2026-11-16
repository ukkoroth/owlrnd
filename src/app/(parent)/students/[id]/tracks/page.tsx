import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumb";
import { TracksOverview } from "@/components/tracks/TracksOverview";
import { requireShell } from "@/server/auth/current";
import { getOwnStudent } from "@/server/students";
import { getDraftChat, listTracks } from "@/server/tracks";
import { flashcardActivity } from "@/server/flashcards";

export const metadata: Metadata = { title: "Tracks · owlrnd" };
export const dynamic = "force-dynamic";

// 2d (none yet) and 2g (with tracks).
export default async function TracksPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { actor } = await requireShell("parent");
  const { id } = await params;
  const student = await getOwnStudent(actor, id);
  if (!student) notFound();
  const list = (await listTracks(actor, id)) ?? [];
  const draft = (await getDraftChat(actor, id))?.draft;
  const { created } = await searchParams;
  const cards = (await flashcardActivity(id)).perTrack;

  return (
    <>
      <Breadcrumb items={[{ label: "Students", href: "/students" }, { label: student.name }, { label: "Tracks" }]} />
      <TracksOverview
        audience={{ kind: "parent", studentId: id, studentName: student.name }}
        list={list}
        hasDraft={!!draft}
        created={!!created}
        timeZone={student.timeZone}
        cardsActivity={cards}
      />
    </>
  );
}
