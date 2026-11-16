import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumb";
import { PageHeader } from "@/components/PageHeader";
import { TrackChat } from "@/components/TrackChat";
import { requireShell } from "@/server/auth/current";
import { getDraftChat, listTracks } from "@/server/tracks";

export const metadata: Metadata = { title: "New track · owlrnd" };
export const dynamic = "force-dynamic";

// sm-2d (start of the chat) → sm-2e (agreed) → sm-2f (created). The chat is kept as a draft, so a reload keeps it.
export default async function LearnerNewTrackPage() {
  const { user: { student }, actor } = await requireShell("learner");
  const chat = await getDraftChat(actor, student.id);
  if (!chat) notFound(); // a parent-managed learner doesn't set up tracks
  const isFirst = ((await listTracks(actor, student.id)) ?? []).length === 0;

  return (
    <div className="lg:-mr-10">
      <Breadcrumb items={[{ label: "Tracks", href: "/tracks" }, { label: "New track" }]} />
      <PageHeader
        title={isFirst ? "Create your first track" : "Create a new track"}
        subtitle="Tell the AI which exam and topics to cover, and attach the syllabus, your notes or a past paper."
      />
      <TrackChat
        studentId={student.id}
        audience={{ kind: "learner" }}
        firstName={student.name.split(" ")[0]!}
        isFirst={isFirst}
        initialMessages={chat.messages}
        initialPreview={chat.preview}
      />
    </div>
  );
}
