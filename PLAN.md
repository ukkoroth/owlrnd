# owlrnd 0.1: build plan

Fresh plan, 2026-11-14, built from the 0.1 hand-off package (`CLAUDE.md`, `docs/`, `screens/`, `mockups/`).
The earlier "All-rounder" prototype (single student, θ/3PL engine, follow-up chains) is archived at
`../owlrnd-archive-2026-11-14-v0prototype/` and is **not** the basis for this build. Its product model (in-exam adaptivity, one question at a time) contradicts the 0.1 rules: whole paper at once, adapt between exams.

## Progress

| Milestone | Status |
|---|---|
| M0 Foundation | ✅ done |
| M1 Accounts | ✅ done |
| M2 Students | ✅ done |
| M3 Tracks with AI | ✅ done |
| M4 Exams | ✅ done |
| M5 Marking and results | ✅ done |
| M6 Goals, history, points | ✅ done |
| Release: closed beta on AWS Lightsail ([docs/release-plan.md](docs/release-plan.md)) | next |

Source-of-truth order: `docs/05-rules.md` → `docs/04-screens.md` / `docs/03-flows.md` → `screens/*.png` → `mockups/*.html`.

---

## 1. Stack (confirmed with owner)

| Layer | Choice | Notes |
|---|---|---|
| App | Next.js 15 (App Router), TypeScript, React 19 | Server components for pages, route handlers / server actions for mutations |
| Styling | Tailwind CSS with the tokens in `docs/08-design.md` | Inter (app) and STIX Two Text (paper) via `next/font` |
| Database | PostgreSQL 16, local via `docker compose` | Drizzle ORM + drizzle-kit migrations (committed SQL, not `push`) |
| Email | Mailpit in dev (SMTP via nodemailer, inbox at localhost:8025); Amazon SES over SMTP in production | Templates for verify, sign-in, reset, change-email codes. Tests read codes from Mailpit's API. `EMAIL_TRANSPORT=console` also available |
| AI | Anthropic SDK, model `claude-opus-5-5` (env-configurable) | Structured outputs validated with Zod before use |
| Files | Local disk `storage/` behind a `FileStore` interface | Swap for S3/R2/Blob when hosted |
| Background work | Postgres-backed job table + in-process worker (`pg` `SKIP LOCKED`) | For marking typed answers and pre-generating the next exam; no Redis |
| Auth | Own implementation | Rules are bespoke (student codes go to the parent). argon2id for passwords and codes; opaque session id in an httpOnly cookie, `sessions` table |
| Tests | Vitest (rules, units), Playwright (flows, paper paging at several window sizes) | |
| Hosting | AWS Lightsail (Mumbai), closed beta | See docs/release-plan.md |

## 2. Project layout

```
src/
  app/                    routes, grouped: (auth) (parent) (student) exam/
  components/             Sidebar, ProfileMenu, TrackCard, BarChart7, ActivityGrid26, Chat, ...
  config/rules.ts         every "(default)" value from docs/10-decisions.md, in one place
  domain/                 pure, unit-tested rule code (no DB, no I/O)
    codes.ts  goals.ts  topicStrength.ts  examMix.ts  scoring.ts
    points.ts levels.ts  suggestions.ts   activity.ts  paging.ts
  server/
    db/ (schema.ts, migrations/)   auth/   email/   files/   jobs/
    ai/ (readMaterial.ts, trackChat.ts, writeQuestions.ts, markAnswer.ts, schemas.ts)
    services/             createTrack (one internal op, reusable by a future connector), buildExam, markExam, ...
tests/e2e/                Playwright
docker-compose.yml        postgres
```

`src/domain` holds the business rules as pure functions so the tests in `CLAUDE.md` ("write tests for the rules") need no database.

## 3. Data model (from `docs/06-data.md`)

Tables: `parents`, `students`, `codes`, `sessions`, `tracks`, `topics`, `track_messages`, `attachments`, `questions`, `exams`, `exam_questions`, `answers`, `marks`, `topic_results` (per answered question; topic strength derived from the last 5), `points_events`, `jobs`.

Decisions in the schema:
- `codes`: `purpose`, `parent_id`, `student_id?`, `code_hash`, `expires_at`, `tries_left`, `used_at`, `invalidated_at`. Resend limit counted from rows in the last hour.
- `tracks.status`: `active | paused | goal_reached | archived`; goal X and N, plus `goal_progress` stored and recomputed after each marked exam.
- `topics.revision_only` and `topics.added_in_message_id` support 2j.
- `exams.status`: `ready | in_progress | submitted | marking | marked`. Answers save as the student works (rules §5: keep answers if they leave and return).
- `questions` keep `explanation`, `key_points[]`, `marks`, `difficulty`, and `reworded_from_question_id` for deliberate retries.
- Attachments: 0.15 adds answer attachments. Keep `attachments` polymorphic (`owner_type`) so that change needs no migration rewrite.
- Students store `time_zone` (from the parent's browser at sign-up), used for "today", streaks and activity.

## 4. Milestones

Each milestone ends with its tests green and a manual walk-through against the screenshots.

### M0 · Foundation (half a milestone) · ✅ done 2026-11-14
- `git init`, Next.js scaffold, Tailwind tokens, fonts, Drizzle + docker Postgres, Vitest, Playwright, ESLint.
- `config/rules.ts` with every default.
- App shell: blue sidebar (logo with three rising bars), profile button slot, responsive stacking.
- Email adapter (Postmark + console), FileStore, job worker skeleton, Anthropic client wrapper.
- **Done when:** `docker compose up && npm run dev` serves an empty shell; `npm test` runs.

### M1 · Accounts: 1a, 1b, 3a, 3b, 5a–5d, 5f, 5g, 5h · ✅ done 2026-11-14
- Sign-up → verify email → (to 2a). Unverified accounts cannot sign in.
- Unified sign-in (username or email + password) → code to the parent's email → 3b with masked email; student wording "Ask your parent for the code".
- Codes: 6 digits, 10 min, single use, new code invalidates older ones, 3 wrong tries → invalidate and auto-send a new one (5f), 5 resends/hour.
- Forgot/reset password for both roles (code to the parent).
- Profile menu + Sign out; parent profile (email change needs a code to the new address; delete account); student profile (read-only).
- **Tests:** every code rule in `domain/codes.ts`; e2e for sign-up → verify → sign out → sign in.

### M2 · Students: 2a, 2b, 2k (cards without charts yet), 5e, plus 2c · ✅ done 2026-11-14
- Add a student (globally unique username), confirmation with sign-in details, students page, edit / new password / remove (confirm, cascade delete).
- Permissions middleware: the parent sees only their own students; the student sees only themselves (rules §10).
- **Done when:** a parent adds two students and each signs in with their own username and the parent's code.

### M3 · Tracks with AI: 2c, 2d, 2e, 2f, 2g
- 2c set-up choice ("Select from packages" disabled, Coming soon).
- Chat (2e/2f): parent messages + attachments (Attach file; Take photo via `<input type="file" accept="image/*" capture>`), AI replies, live track preview (Draft → Ready), Create track enabled only when name, topics and goal are agreed.
- AI §1 readMaterial (extract text per attachment, topics; flag unreadable photos), AI §2 trackChat returning `{reply, preview: {name, topics[], testDate?, goal{X,N}}, ready}`.
- `createTrack` service: one internal operation (roadmap item 4 will reuse it). On confirm, write the track and enqueue generation of the **first exam** (even topic coverage).
- 2g tracks page with track cards (untested topics, goal 0 of N); pause / resume.
- **Done when:** a parent creates a track from a description plus photos, edits the suggested goal, confirms, and a first exam is ready.

### M4 · Exams: 3c–3g, 4.1a, 4.1b, 4.1c, 4.2a–4.2c
- `buildExam`: topic mix from `domain/examMix.ts` (first exam even; later 50 / 30 / 20; revision ~2 questions; harder strong repeats when nothing is weak or untested), no identical repeat within 3 exams except retries; AI §3 writes questions to fill the mix; the result is stored as a fixed paper.
- Pre-generation: each active track keeps one `ready` exam so Start is instant. A new one is generated after each marking.
- Student dashboard: Today (suggestions per rules §7, "N completed today"), Recent exams, All tracks; first-day and nothing-to-practise states; Your tracks.
- **Exam paper** (the hardest UI piece):
  - Serif paper styling, two columns where the mockup shows them.
  - `domain/paging.ts` + a client hook: render every question offscreen at real size, measure, pack page by page without splitting a question; never below 16px; re-page on resize while keeping answers and the current question's page; "Page X of Y", Next/Previous, Submit on the last page only; continuous numbering.
  - Answers autosave (debounced) to the server.
  - 4.1c warning that names the blank questions, with "Go to question N" / "Submit anyway".
- **Tests:** paging unit tests on synthetic heights; Playwright at 1280×720, 1440×900 and 1024×640 asserting `document.scrollingElement.scrollHeight <= innerHeight` on every page.

### M5 · Marking and results: 4.1d, 4.1e, 4.1f, 4.1g
- On submit: multiple choice marked immediately; short and long answers enqueued for AI §4 marking (equivalence for short; key points with partial marks for long).
- 4.1d progress screen (polls job status); the student may leave and the result appears on the dashboard.
- Score scaled to /10 and rounded; topic strength, goal progress and points updated in one transaction after marking.
- 4.1e result with points breakdown and "next exam will focus on…" (from the same mix function used to build it).
- 4.1f marked paper (tick/cross, correct answer filled, wrong answer ringed, one-line reason); 4.1g written answers (verdict, marks, full answer, feedback).
- **Tests:** scoring, topic strength, and the worked example in rules §8 (= 41 points).

### M6 · Goals, history, points, charts: 2h, 2i, 2j, 4.3a, charts on 3c and 2k
- Goal reached → status stops exams, student sees "Goal reached" with no Start, parent sees "Add topics to continue" + Archive.
- 2j add-topics chat (same chat component, "extend" mode): new topics, earlier topics marked revision, new goal, progress back to 0, status active.
- 2h exam history table with links to marked papers.
- Points page with levels; sidebar total + level on every student screen; parent sees the same.
- 7-day bar chart and 26-week activity grid (shared component, student time zone, 5 shades).
- **Tests:** goal progress and reset, restart flow, streak points (day 7 rule), daily 5-exam cap, activity bucketing across time zones.

## 5. Cross-cutting

- **Accessibility:** real buttons/links/labels, 44px targets, 4.5:1 contrast, meaning never by colour alone. Run axe in Playwright on the main screens.
- **AI guardrails (AI §6):** every prompt includes only the track's topics and material and the student's class; outputs are schema-validated; topics not in the track are rejected; answers never sent to the client before submit (the exam API strips `correct_option`, `expected_answer` and `key_points`).
- **Security:** rate-limit sign-in and code endpoints; generic errors on unknown usernames; CSRF-safe server actions; hashed codes.
- **Seed script:** one demo parent, two students and a track with a few marked exams, so 2h, 2i, 2k and 3c can be checked without hours of clicking.

## 6. Questions for the owner (defaults used until answered)

| # | Question | Working default |
|---|---|---|
| 1 | Postmark sender address/domain and server token (only needed once real families use it) | Mailpit in dev |
| 2 | Anthropic API key for local dev | Required from M3 |
| 3 | 2e shows **Take photo** for textbook pages. Is a simple file picker with `capture` enough on laptops, or do you want an in-page camera view (like 0.2a)? | File picker with `capture` |
| 4 | How many questions does the first exam have, and what type mix? The rules say "at most 10" but give no type mix | 10 questions; type mix chosen by the AI from the material, at least half multiple choice |
| 5 | Should exams be pre-generated (instant Start) or generated on Start (fresher, but a 10–30 s wait)? | Pre-generated, one ready exam per active track |
| 6 | Everything else in `docs/10-decisions.md` | The defaults written there, all in `config/rules.ts` |

## 7. Not in 0.1 (see `docs/09-roadmap.md`)

Answer uploads (0.15), camera capture (0.2), packages, Claude connector, several tracks per chat, flashcards, progress pages, college version, teachers, mobile apps, payments.
