import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireShell } from "@/server/auth/current";
import { getPaper } from "@/server/exams";
import { getResult } from "@/server/results";
import type { TopicTally } from "@/domain/topicStrength";
import { inSentence } from "@/domain/examMix";

export const metadata: Metadata = { title: "Exam result · owlrnd" };
export const dynamic = "force-dynamic";

const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** "Strong on A and B. C needs more work." (templated, not AI). */
function summary(strengths: TopicTally[], needsWork: TopicTally[]) {
  const s = strengths.map((t) => inSentence(t.name));
  const n = needsWork.map((t) => inSentence(t.name));
  const parts: string[] = [];
  if (s.length) parts.push(`Strong on ${list(s)}.`);
  if (n.length) parts.push(`${list(n)} ${n.length === 1 ? "needs" : "need"} more work.`);
  return parts.join(" ").replace(/^./, (c) => c.toUpperCase());
}

function TopicBar({ t, weak }: { t: TopicTally; weak: boolean }) {
  return (
    <li>
      <div className="flex justify-between text-[16px]">
        <span>{t.name}</span>
        <span className="font-semibold">
          {t.right} of {t.total}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 rounded bg-pale-2" aria-hidden="true">
        <div className={`h-1.5 rounded ${weak ? "bg-danger" : "bg-brand"}`} style={{ width: `${(t.right / t.total) * 100}%` }} />
      </div>
    </li>
  );
}

// 4.1e
export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { user: { student } } = await requireShell("learner");
  const { id } = await params;
  const r = await getResult(student.id, id);
  if (!r) {
    const paper = await getPaper(student.id, id);
    if (!paper) notFound();
    redirect(paper.status === "ready" || paper.status === "in_progress" ? `/exam/${id}` : `/exam/${id}/marking`);
  }
  const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: student.timeZone }).format(r.exam.submittedAt);

  return (
    <>
      <p className="text-sm text-ink-muted">
        {r.track.name} · Exam {r.exam.number} · {date}
      </p>
      <h1 className="text-[32px] leading-tight">Exam result</h1>

      <div className="mt-5 flex flex-wrap items-start gap-x-12 gap-y-4 border-b border-ink pb-6">
        <div>
          <p className="text-[64px] font-semibold leading-none">
            {r.exam.score} / 10
          </p>
          <p className="mt-1 text-ink-muted">
            {r.questionCount === 10 ? "questions correct" : `${r.right} of ${r.questionCount} questions correct`}
          </p>
        </div>
        <p className="max-w-[640px] pt-3 text-[18px] leading-relaxed">{summary(r.strengths, r.needsWork)}</p>
      </div>

      {r.points.length > 0 && (
        <section className="card mt-6 grid gap-6 md:grid-cols-[160px_1fr]" aria-label="Points earned">
          <div>
            <p className="text-[40px] font-semibold leading-none text-brand">+{r.pointsEarned}</p>
            <p className="mt-1 text-ink-muted">points earned</p>
            <Link href="/points" className="link mt-3 inline-block font-semibold">
              See your points
            </Link>
          </div>
          <ul className="divide-y divide-line border-b border-line">
            {r.points.map((p, i) => (
              <li key={i} className="flex justify-between py-2 text-[15px]">
                <span>{p.label}</span>
                <span className="font-semibold">+{p.points}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-7 grid gap-8 md:grid-cols-2">
        <section aria-labelledby="strengths-h" role="region">
          <h2 id="strengths-h" className="mb-3 text-[15px] font-bold uppercase tracking-wider">
            Strengths
          </h2>
          {r.strengths.length ? (
            <ul className="flex flex-col gap-4">
              {r.strengths.map((t) => (
                <TopicBar key={t.topicId} t={t} weak={false} />
              ))}
            </ul>
          ) : (
            <p className="text-ink-muted">Keep going: every exam shows where you are improving.</p>
          )}
        </section>
        <section aria-labelledby="needs-h" role="region">
          <h2 id="needs-h" className="mb-3 text-[15px] font-bold uppercase tracking-wider">
            Needs work
          </h2>
          {r.needsWork.length ? (
            <ul className="flex flex-col gap-4">
              {r.needsWork.map((t) => (
                <TopicBar key={t.topicId} t={t} weak />
              ))}
            </ul>
          ) : (
            <p className="text-ink-muted">Nothing this time. Well done!</p>
          )}
        </section>
      </div>

      <section className="mt-8 border-t border-line pt-6" aria-labelledby="next-h">
        {r.goalReached ? (
          <>
            <h2 id="next-h" className="text-[15px] font-bold uppercase tracking-wider text-brand">
              Goal reached!
            </h2>
            <p className="mt-2 max-w-[760px] text-[16px] leading-relaxed">
              You scored {r.track.goalThreshold} / 10 or better in {r.track.goalRunLength} {r.track.goalRunLength === 1 ? "exam" : "exams in a row"}. This track stops
              here until your parent adds new topics.
            </p>
          </>
        ) : (
          <>
            <h2 id="next-h" className="text-[15px] font-bold uppercase tracking-wider">
              Your next exam in this track
            </h2>
            <p className="mt-2 max-w-[760px] text-[16px] leading-relaxed">
              {r.nextFocus} {r.strongCount} of the {r.topicCount} topics {r.strongCount === 1 ? "is" : "are"} strong so far.
            </p>
          </>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <a href={`/exam/${r.exam.id}/marked`} className="btn-primary">
            See marked paper
          </a>
          <Link href="/tracks" className="link font-semibold">
            Back to your tracks
          </Link>
        </div>
      </section>
    </>
  );
}
