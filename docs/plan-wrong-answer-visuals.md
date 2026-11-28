# Plan: pictures for wrong answers

Status: built 2026-11-28 (owner decisions below). Previews: `tmp/visuals-preview/index.html` (local only; uses a learner's real answers). Behaviour and cost: `docs/07-ai.md` §8.

## What

On the marked paper (4.1f), a wrong answer can get a short animated picture, **shown by default** under its "Why" line (owner, 2026-11-28: no See it button). It shows the learner's mistake in red, the right idea in navy, in up to 5 captioned steps. A picture is added only when it makes the idea clearer than the "Why" line. Names and definitions get none.

## Evidence

Agni's 60 most recent misses (Physics: Light energy, exams 10–20) come from 14 repeated misunderstandings. The biggest ones: measuring an angle from the surface instead of the normal (8), R = 2f (7), ray-diagram rules (7), and speed vs refractive index (7). About 54 of the 60 would get a picture. Optics is unusually visual; vocabulary-heavy tracks would get far fewer.

## How

1. **When questions and cards are written** (owner: so cards can show them too). A `draw_visuals` job is queued after a paper, a pool batch or cards are saved, and draws up to 10 items per AI call; writing never waits for it. Because the picture exists before anyone answers, it shows the common slip in neutral words rather than the learner's own answer. Older rows are drawn only when an exam or practice session picks them.
2. **Scene format** (`domain/visualScene.ts`): size, named points (absolute or `{from, deg, len}`), base items, and ≤ 5 steps of `{caption, add: items}`. Items: `seg` (arrow mid/end/both, dash), `path`, `poly`, `rect`, `hatch`, `angle` (degrees), `dot`, `text`, `dim`, `group`, and the actions `move`, `rotate` and `fade`. Angles are numbers, so the geometry is correct by construction.
3. **Validation:** zod schema plus checks for the frame bounds, that named points exist, ≤ 40 shapes, ≤ 5 steps, captions ≤ 140 characters and labels ≤ 24. One retry with the problems listed, then null. A bad scene is never shown.
4. **Storage:** `questions.visual` and `flashcards.visual` (jsonb, null when none helps), with `visual_drawn_at`. When it's present, the marked paper shows the picture inline. `usePaging` measures the question with its picture, so pages hold fewer questions and still never scroll (rules §5). The picture is capped at about a third of the page height, with the steps beside it on wide screens and below it on narrow ones. Marking and results never wait for it; a picture that arrives later shows on the next visit.
5. **Limits (AI §6):** only the content of the question, its explanation and the track material; the voice rules from `ai/voice.ts`; counted against the AI allowance and recorded as `draw_visuals`. When the allowance is used up, no pictures are drawn.
6. **Accessibility:** the captions are a real text list and the picture has a text description; each picture plays once when its page is shown, with a Replay button (≥ 44px); with reduced motion the finished picture shows at once.

## Build steps

- **V1** Scene schema, validator and unit tests; `components/exam/SceneView.tsx`; the nine previews as fixtures and a `/dev/visuals` page.
- **V2** `ai/drawVisuals.ts`, a fake-AI version for tests, the `draw_visuals` job, the migration, usage recording.
- **V3** The picture inline in `MarkedPaper.tsx` (learner and parent views), playing when its page is shown. Paging tests: a question with its picture always fits on one page. E2E test: the paper never scrolls on a phone, an iPad or a desktop.
- **V4** Run on a copy of Agni's recent exams; measure the hit rate, rejections and cost per exam; ship behind `rules.visuals.enabled`.

## Cost (measured)

$0.27 per 10 items on Opus 5.5 at medium effort (docs/07-ai.md §8), so roughly $0.27 per exam's new questions, plus cards. Counted against the account's AI allowance like other calls.

## Decisions for the owner

1. Decided: when questions and cards are written, so flashcards show them too.
2. Decided: Opus 5.5 to start; review usage after some exams.
3. ~~Where~~ Decided: inline on the marked paper, shown by default.
4. Decided: no pictures on the sample track for now.
