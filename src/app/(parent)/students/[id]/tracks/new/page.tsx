import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumb";
import { PageHeader } from "@/components/PageHeader";
import { TrackChat } from "@/components/TrackChat";
import { requireShell } from "@/server/auth/current";
import { getOwnStudent } from "@/server/students";
import { getDraftChat, listTracks } from "@/server/tracks";

export const metadata: Metadata = { title: "New track · owlrnd" };
export const dynamic = "force-dynamic";

// 2e (start of the chat) → 2f (agreed). The chat is kept as a draft track, so a reload keeps it.
export default async function NewTrackPage({ params }: { params: Promise<{ id: string }> }) {
  const { user: { parent }, actor } = await requireShell("parent");
  const { id } = await params;
  const student = await getOwnStudent(actor, id);
  if (!student) notFound();
  const chat = (await getDraftChat(actor, id))!;
  // The first track while the student has no live track (the draft being created isn't live yet).
  const isFirst = ((await listTracks(actor, id)) ?? []).length === 0;

  return (
    <div className="lg:-mr-10">
      <Breadcrumb items={[{ label: "Students", href: "/students" }, { label: student.name }, { label: "Tracks", href: `/students/${id}/tracks` }, { label: "New track" }]} />
      <PageHeader
        title={isFirst ? `Create ${student.name}'s first track` : `Create a new track for ${student.name}`}
        subtitle="Tell the AI what the track should cover and attach textbook pages, a syllabus photo or a description."
      />
      <TrackChat
        studentId={id}
        studentName={student.name}
        parentFirstName={parent.name.split(" ")[0]!}
        isFirst={isFirst}
        initialMessages={chat.messages}
        initialPreview={chat.preview}
      />
    </div>
  );
}
