import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumb";
import { PageHeader } from "@/components/PageHeader";
import { TrackUpdateChat } from "@/components/TrackUpdateChat";
import { requireShell } from "@/server/auth/current";
import { getUpdateChat } from "@/server/trackUpdates";

export const metadata: Metadata = { title: "Update track · owlrnd" };
export const dynamic = "force-dynamic";

// sm-2i (add topics to restart a goal-reached track) and Add material (active or paused track).
export default async function LearnerUpdateTrackPage({ params }: { params: Promise<{ trackId: string }> }) {
  const { user: { student }, actor } = await requireShell("learner");
  const { trackId } = await params;
  const chat = await getUpdateChat(actor, trackId);
  // A sample track takes no topics or material: its questions are written in advance.
  if (!chat || chat.track.status === "archived" || chat.track.sampleKey) notFound();
  const { track, mode } = chat;
  const restart = mode === "restart";
  const reachedOn = track.goalReachedAt
    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: student.timeZone }).format(track.goalReachedAt)
    : null;

  return (
    <div className="lg:-mr-10">
      <Breadcrumb
        items={[{ label: "Tracks", href: "/tracks" }, { label: track.name ?? "", href: `/tracks/${trackId}` }, { label: restart ? "Add topics" : "Add material" }]}
      />
      <PageHeader
        title={`${restart ? "Add topics" : "Add material"}: ${track.name}`}
        subtitle={
          restart
            ? "You reached this track's goal. Add what comes next and set a new goal to start it again."
            : "Add pages, notes or topics. The AI explains how the plan changes, and nothing changes until you apply it."
        }
      />
      <TrackUpdateChat
        mode={mode}
        trackId={trackId}
        audience={{ kind: "learner" }}
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
