import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumb";
import { PageHeader } from "@/components/PageHeader";
import { TrackUpdateChat } from "@/components/TrackUpdateChat";
import { requireShell } from "@/server/auth/current";
import { getUpdateChat } from "@/server/trackUpdates";

export const metadata: Metadata = { title: "Update track · owlrnd" };
export const dynamic = "force-dynamic";

// 2j (restart a goal-reached track) and Add material (active or paused track).
export default async function UpdateTrackPage({ params }: { params: Promise<{ id: string; trackId: string }> }) {
  const { actor } = await requireShell("parent");
  const { id, trackId } = await params;
  const chat = await getUpdateChat(actor, trackId);
  if (!chat || chat.student.id !== id || chat.track.status === "archived") notFound();
  const { track, student, mode } = chat;
  const restart = mode === "restart";
  const reachedOn = track.goalReachedAt
    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: student.timeZone }).format(track.goalReachedAt)
    : null;

  return (
    <div className="lg:-mr-10">
      <Breadcrumb
        items={[
          { label: "Students", href: "/students" },
          { label: student.name },
          { label: "Tracks", href: `/students/${id}/tracks` },
          { label: track.name ?? "", href: `/students/${id}/tracks/${trackId}` },
          { label: restart ? "Add topics" : "Add material" },
        ]}
      />
      <PageHeader
        title={`${restart ? "Add topics" : "Add material"}: ${track.name}`}
        subtitle={
          restart
            ? `${student.name} reached this track's goal. Add what comes next and set a new goal to start it again.`
            : "Add textbook pages or topics. The AI explains how the plan changes, and nothing changes until you apply it."
        }
      />
      <TrackUpdateChat
        mode={mode}
        trackId={trackId}
        studentId={id}
        studentName={student.name}
        trackName={track.name ?? ""}
        currentTopics={chat.topics.map((t) => t.name)}
        goal={{ threshold: track.goalThreshold ?? 8, runLength: track.goalRunLength ?? 3 }}
        goalProgress={track.goalProgress}
        goalReachedOn={reachedOn}
        initialMessages={chat.messages}
        initialUpdate={chat.update}
      />
    </div>
  );
}
