import { existsSync, readFileSync } from "node:fs";
import { notFound } from "next/navigation";
import type { Scene } from "@/domain/visualScene";
import { SceneView } from "@/components/visuals/SceneView";
import { sampleVisuals } from "@/content/visuals/samples";

// Dev-only gallery of the picture renderer (docs/plan-wrong-answer-visuals.md), with the nine preview scenes.
export const dynamic = "force-dynamic";

export default function VisualsPreview() {
  if (process.env.NODE_ENV === "production" && process.env.OWLRND_DEV_PAGES !== "1") notFound();
  // The last live run of `npm run ai:visuals`, if any (git-ignored).
  const live: { prompt: string; answer: string; scene: Scene | null }[] = existsSync("tmp/visuals-smoke.json") ? JSON.parse(readFileSync("tmp/visuals-smoke.json", "utf8")) : [];
  return (
    <main className="mx-auto max-w-paper px-4 py-8">
      <h1 className="text-[28px] font-semibold">Pictures for questions and cards</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {sampleVisuals.map((v) => (
          <section key={v.key} data-visual={v.key} className="rounded border border-line bg-white p-5">
            <p className="font-paper text-[17px] leading-snug text-paper-ink">{v.prompt}</p>
            <p className="mb-3 mt-1 text-sm text-paper-muted">
              Answer: <b className="text-paper-select">{v.answer}</b>
            </p>
            <SceneView scene={v.scene} />
          </section>
        ))}
      </div>
      {live.length > 0 && (
        <>
          <h2 className="mt-10 text-[22px] font-semibold">Last live run ({live.filter((v) => v.scene).length} of {live.length} with a picture)</h2>
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            {live.map((v, i) => (
              <section key={i} data-live={i} className="rounded border border-line bg-white p-5">
                <p className="font-paper text-[17px] leading-snug text-paper-ink">{v.prompt}</p>
                <p className="mb-3 mt-1 text-sm text-paper-muted">
                  Answer: <b className="text-paper-select">{v.answer}</b>
                </p>
                {v.scene ? <SceneView scene={v.scene} /> : <p className="text-sm font-semibold text-ink-muted">No picture</p>}
              </section>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
