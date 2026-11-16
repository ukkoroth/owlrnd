# owlrnd 0.3 "Flashcards": plan (for review, nothing built yet)

Written 2026-11-16 at the owner's request: plan the flashcards feature with previews before developing. **0.3** follows 0.2 (two kinds of account), which is being tested on the owner's local network first.

## What it is

Exams test; flashcards help a learner **learn and keep** what's in a track between exams. Each track gets a deck of short cards written by the AI from the track's topics and material. A learner practises a few minutes at a time: see the front, think, show the answer, and say **Got it** or **Not yet**. "Not yet" cards come back sooner; known cards come back rarely (spaced repetition).

**Principles:**
- **No marks, no effect on the goal.** Flashcards never change an exam score, topic strength or goal progress (rules §3–§6 stay as they are). They are practice, not assessment.
- **Same tracks, same limits.** Cards come only from the track's topics and the account holder's material (AI §6), stay in that account (terms, "Your material"), and count against the AI allowance.
- **Quick.** A session is about 10 cards, a few minutes, and fits the screen without scrolling (like the paper, rules §5).
- **Works after a goal is reached.** A finished track can still be revised with flashcards, without restarting it.

## Previews

Static previews in the app's style; sample data. Notes on each preview explain it.

| Code | Screen | Preview |
|---|---|---|
| fc-1 | Dashboard: **Practise · N flashcards** under Start on each suggestion | [png](../screens/fc-1_dashboard-practise-button.png) · [html](../mockups/fc-1_dashboard-practise-button.html) |
| fc-2 | Session: card front (focus mode, no sidebar), "Show answer", Space | [png](../screens/fc-2_card-front.png) · [html](../mockups/fc-2_card-front.html) |
| fc-3 | Session: card back, answer and explanation, **Not yet** / **Got it** (keys 1 / 2); phone layout | [png](../screens/fc-3_card-back.png) · [phone](../screens/fc-3m_card-back-phone.png) · [html](../mockups/fc-3_card-back.html) |
| fc-4 | Session done: got it / to see again by topic, points, when cards come back, next steps | [png](../screens/fc-4_session-done.png) · [html](../mockups/fc-4_session-done.html) |
| fc-5 | Your tracks: the deck on each track card ("24 cards · 8 to practise today"), Practise, and a Flashcards link (also on goal-reached tracks) | [png](../screens/fc-5_track-card-flashcards.png) · [html](../mockups/fc-5_track-card-flashcards.html) |

Not previewed yet (simple list screens, built in F3): **fc-6** a track's deck (all cards by topic, with "to practise" and "known"), and the parent's view (fc-7, below).

## Rules (working defaults, all in `rules.ts`)

**Cards.**
- A card has a front (a question or term, one or two lines), an answer (a word, number with unit, or short sentence) and a one-line explanation, and belongs to one topic of one track.
- Two sources: **written from the material** (the AI) and **from a missed exam question** (the AI rewrites a question the learner got wrong into a card, so it isn't the identical question; marked "From a missed exam question", fc-2).
- Revision topics after a restart get cards too, at a lower share.
- **Exams and cards rarely repeat each other** (owner, 2026-11-16): each writer sees the other's wording and is asked to test the same idea another way. More than one near-copy in a paper or batch gets one rewrite; after that it is kept (`rules.flashcards.repeats`, AI §7).

**Writing the deck.**
- When a track is created (or restarted), the AI writes a starter deck: about 6 cards per active topic, up to 60 **(default)**, in the background like the first exam.
- After each marked exam, up to 3 missed questions on topics that need work become cards **(default)**.
- When fewer than 10 cards are due and the learner taps Practise, a top-up of up to 10 new cards is written for the weakest and least-covered topics, then the session starts.
- The deck is never more than 200 cards per track **(default)**.

**A session.**
- About 10 cards **(default)**: cards due first (oldest due first), then new cards, weighted to weak and untested topics as exams are (rules §4: 50% needs work, 30% not tested, 20% strong).
- The learner can leave at any time; answered cards count.

**Spaced repetition** (Leitner boxes, the simplest that works):
- Each card is in box 1–5. **Got it** moves it up one box; **Not yet** moves it to box 1.
- A card is next due after: box 1: same session's end or next day; box 2: 2 days; box 3: 4 days; box 4: 8 days; box 5: 16 days **(default)**.
- "N flashcards" on a button = cards due today (or, if none are due, the top-up size).

**Points** (rules §8 addition): finishing a session of at least 8 cards earns **5 points**, at most **2 sessions a day** per track count **(default)**. No points per card, so there's no reason to tap "Got it" dishonestly.

**Who can do what** (editions §2.3, one policy): flashcards are practice, so `practise` (the learner, including a parent-managed child, subject to M10 consent). The parent sees a child's flashcard activity but doesn't practise. Writing cards uses the account holder's AI allowance.

## Where it appears

- **Dashboard (fc-1):** each suggestion card gets **Practise · N flashcards** under Start, an outline-dashed secondary button. The "All tracks" tab shows cards due per track.
- **Your tracks (fc-5):** the deck line on each card, **Practise**, and a **Flashcards** link to the deck (fc-6). Goal-reached tracks keep Practise.
- **Session (fc-2–fc-4):** its own focus-mode route `/practise/[trackId]`, like the exam paper.
- **Parent (fc-7, F4):** on the child's tracks page and 2k card, a line such as "Flashcards: 3 sessions this week · 41 cards known". No card content needed.
- **Activity charts:** flashcard sessions show as a separate, lighter series (not counted as exams).

## Data (additive migration)

- `flashcards`: `id`, `track_id`, `topic_id`, `front`, `answer`, `explanation`, `source` (`material | missed_question`), `source_question_id` (nullable), `box` (1–5), `due_at`, `created_at`. Cards belong to the track, so they go with it when it's deleted, and are never shared across accounts.
- `flashcard_sessions`: `id`, `student_id`, `track_id`, `started_at`, `finished_at`, `cards_seen`, `got_it`.
- `flashcard_reviews`: `session_id`, `card_id`, `result` (`got_it | not_yet`), `at`. The audit of practice, and the data for "how it went by topic" (fc-4).
- `points_kind` gains `flashcards`. `ai_purpose` gains `write_flashcards`.

## AI (`docs/07-ai.md` addition)

- **Write cards:** input: track name, level, topics (key, name, description, strength), material, cards already in the deck (fronts, to avoid repeats), how many per topic. Output: `{ topicKey, front, answer, explanation }[]`, validated (lengths, known topic keys, no duplicates). Same "you"/parent wording as exams (M9), and the same limits: only the track's topics and the account holder's material.
- **Missed question → card:** the question, the expected answer and the explanation in; one card out that asks the same idea in new words.
- Fake AI gets a deterministic card writer for tests.

## Milestones

**F1 done (2026-11-16):** tables (migration `0014_flashcards`), the AI card writer with validation and a fake for tests (`src/server/ai/writeFlashcards.ts`), and the `write_flashcards` job (`src/server/flashcards.ts`): a starter deck when a track is created or gets new topics, up to 3 cards per marked exam from missed questions on weak topics (once per exam), and top-ups. It waits, like exam writing, while the monthly budget, the account's AI allowance or a parent's consent stops it. Nothing is shown to learners until F2/F3.

**F2 done (2026-11-16):** the session at `/practise/[trackId]` (focus mode, `src/components/flashcards/FlashcardSession.tsx`): card front, Show answer (Space), Not yet / Got it (1 / 2) saved as they're given, Leave at any time, and the summary (fc-4) by topic with "Practise these N again", "Start exam N" and Back. Up to 10 due cards per session, lower boxes and weaker topics first; with nothing due a top-up is written first. Answers move cards between boxes already (F3 adds the buttons and counts). Not linked from anywhere yet (decision #7); reachable by URL for testing. Points come with F3.

**F3 done (2026-11-16):** **Practise · N flashcards** under Start on every dashboard suggestion (fc-1, also the first-day card and "all caught up" list), and N to practise on the All tracks tab ("Practise · 10 new flashcards" when none are due, since a top-up is written first); on Your tracks (fc-5, both kinds of learner) the deck line ("24 cards · 8 to practise today · Last: yesterday"), Practise, and a **Flashcards** link to the deck page `/tracks/[id]/flashcards` (fc-6: cards by topic, To practise / Learning / Known). Goal-reached tracks keep Practise; paused and archived tracks don't. Points: 5 per finished session of 8+ cards, at most 2 a day per track, shown on the summary and the points page (migration `0015_flashcard_points`: points events link to an exam or a flashcard session). Rules §8 and §9a, data doc updated.

| Milestone | Builds | Done when |
|---|---|---|
| **F1 · Deck** ✅ 2026-11-16 | Tables; AI card writer; starter deck on track creation/restart; cards from missed questions after marking; top-up | A new track gets a starter deck in the background; a missed question becomes a card |
| **F2 · Session** ✅ 2026-11-16 | `/practise/[trackId]`: front, Show answer, Got it / Not yet, keyboard, leave; session done (fc-2–fc-4) | A learner practises 10 cards and sees the summary; the page never scrolls at 1280×800 and 390×844 |
| **F3 · Spaced repetition and places** ✅ 2026-11-16 | Boxes and due dates; Practise buttons with counts on the dashboard and track cards (fc-1, fc-5); the deck page (fc-6); points | "Not yet" cards come back next day, "Got it" ones later; counts on buttons match due cards; points as in the rules |
| **F4 · Parents and charts** ✅ 2026-11-16 | Parent's line on a child's tracks page and 2k card (fc-7); activity chart series | A parent sees a child's flashcard activity; a child's session doesn't count as an exam anywhere |

**F4 done (2026-11-16):** the parent's line (fc-7) on each child's 2k card ("Flashcards: 3 sessions in the last 7 days · 41 cards known") and on each track card of the child's tracks page ("· 12 of 24 cards known"), with no card content and no Practise button. The 7-day activity chart (3c and 2k) gets flashcard sessions as a second, narrower teal series with a legend and its own counts, only when there were sessions that week; the 26-week grid, "exams completed", streaks and exam numbers stay exams only. A session counts once at least one card is answered. All of 0.3 F1–F4 is built; the release tasks below remain.

**After testing (owner, 2026-11-16):** a new track showed only "Practise" while its first exam was being written, which looked like flashcards came first. Now there's no Practise button until the starter deck exists, and wherever a track's next exam is being written (the dashboard, the track cards, the child's tracks page and the parent's student card) it says "being prepared" with a progress bar, and the page updates itself when the exam is ready.

## After F4: release tasks (owner, 2026-11-16)

- [ ] **Website** (`src/app/(site)`, landing page): add flashcards to the features (learn between exams, spaced repetition, no marks), with an HD screenshot of a session (fc-3) and the Practise button (fc-1); check the FAQ and the For parents section mention it; privacy page already covers flashcards ("Your material").
- [ ] **README on GitHub:** flashcards in the feature list and screenshots (HD, deviceScaleFactor 2), the `write_flashcards` job, and the new routes.
- [x] **AI usage estimate** *(done 2026-11-16 from the owner's test track: starter deck of 60 cards $0.21, top-up of 10 cards $0.04–0.06, exam $0.09, chat $0.04–0.16; missed-question cards and marking still estimated)* (README "Running costs", `docs/release-plan.md`): add flashcards: the starter deck per track (~6 cards per topic, up to 60), up to 3 cards per marked exam, top-ups of 10, and the longer exam prompt (the deck's fronts). Measure from `ai_usage` (`npm run ai:usage`, purpose `write_flashcards`) on real tracks during local testing, then update the per-exam, per-learner-per-month and $10 demo allowance figures (how many exams and sessions it covers).
- [ ] Release notes for v0.3.0.

## Tests

- Unit: box moves and due dates; session picking (due first, then the topic mix); points cap; card validation.
- Integration: starter deck written in the background; missed questions become cards once; top-up only when few are due; cards never cross accounts; a parent-managed child can practise, the parent can't; consent-blocked learners can't (M10); AI usage recorded against the account holder.
- Playwright: Practise from the dashboard → 10 cards with keyboard and mouse → summary → counts update; a goal-reached track can still be practised; no scrolling at desktop and phone sizes.

## Decisions (owner, 2026-11-16)

All seven working defaults below are **approved** as written. On #5, the owner adds: flashcards will get **their own tracker later** (separate from exam streaks and points), so 0.3 keeps flashcards out of streaks.

### As proposed

| # | Question | Working default |
|---|---|---|
| 1 | Version name and number | **owlrnd 0.3 "Flashcards"** |
| 2 | Points for flashcards | 5 points per finished session of 8+ cards, at most 2 a day per track; none per card |
| 3 | Session size | About 10 cards |
| 4 | Starter deck size | About 6 cards per active topic, up to 60; deck at most 200 |
| 5 | Should flashcards count as "practice" for streaks (rules §8 streak bonus)? | **No** in 0.3: streaks stay exam-based, so flashcards don't replace exams |
| 6 | Where the session lives | Focus mode (no sidebar), like the exam paper |
| 7 | Show the button before F3 is finished? | No: the button appears only when the feature works |
