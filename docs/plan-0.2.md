# owlrnd 0.2 plan: one site, two kinds of account

Written 2026-11-15. **0.1** is what is live on owlrnd.com today: parents set up practice for their children. **0.2** adds the self-managed learner, who signs up "For me", sets up their own practice and is now the main product (`docs/11-editions.md`). The parent path stays and keeps working throughout.

## Version names

The 0.1 brief used "0.15" and "0.2" for written-answer upload and camera capture. Those two are now unnumbered roadmap items. Their screen codes (0.15a, 0.2a) and file names stay as they are. From here on, **0.2 means this plan**.

## Goal and done-when

A competitive-exam aspirant can go to owlrnd.com, choose **For me**, sign up, build their own tracks with the AI, and practise adaptive exams. Ready-made packages are not in 0.2 (owner, 2026-11-15). Sign-in codes go to their own email. Existing families notice nothing except the new first question at sign-up and the new landing page.

## Approach: extend the tables we have, don't rebuild accounts

0.1 stores parents and students in separate tables, and tracks, exams, points and sessions all hang off `students`. A full rewrite into a single `accounts` table would touch nearly every query on a live app. Instead:

- **Every learner is a row in `students`** (treated in code as "learner"). It gains `type` (`self_managed` | `parent_managed`), `email`, `email_verified_at`, `date_of_birth`, consent fields, and `parent_id` becomes optional (required for `parent_managed`, empty for `self_managed`).
- **Parents stay in `parents`** (account type `parent`). Their table is the "family" in brief §3 for now. A second parent per family is later.
- **The account holder** is whoever controls a learner: the parent for a parent-managed learner, the learner themselves for a self-managed one. One function, `controllerOf(learner)`, answers "whose email gets the code", "whose AI limits apply" and "who may change this track".
- **Tracks keep `student_id`.** That is the owner the brief asks for, because every track already belongs to one learner. (`source_package` waits until packages arrive.)
- This meets brief §3 (three account types, parent link, owner; packages come later) without moving existing data. Existing rows migrate to `parent` and `parent_managed` with an additive migration, and no downtime is needed.

## Milestones

Finish and test each before starting the next, as in 0.1. M7 continues the 0.1 numbering. Learner screen codes below refer to `docs/04b-screens-self-managed.md` (files `sm-*`); "P·" marks a parent screen from `docs/04-screens.md`.

| Milestone | Builds | Done when |
|---|---|---|
| **M7 · Shared core** | Data model and migration; one permission policy; codes to the account holder; session timeout per type | All 0.1 tests pass unchanged; the policy has a test for every row of brief §2.3; a self-managed learner made in a test can sign in with a code sent to their own email |
| **M8 · Sign-up and sign-in for both** | "Who is this account for?"; For me sign-up with date of birth and verification; one sign-in page; landing page for learners with a `#parents` section (1a–1c, 3a, 3b, 5a–5e) | Someone can sign up For me or For my child and lands on the right home; no last user is pre-filled after sign-out |
| **M9 · Learners set up their own tracks** | Track chat, tracks pages, pause, archive, goal reached and add topics, all in the learner's own shell (2a with packages as Coming soon, 2c–2i, 4.1a, 3c–3g) | A self-managed learner creates a track from a description and photos, practises it to its goal and restarts it by adding topics |
| **M10 · Under-18 consent** | Parent's details (1d); pending banner (1e); parent's consent page with an email code (1f); reminders, expiry, decline; audit record | An under-18 learner practises straight away; the parent agrees or declines from the email; declining closes the account and deletes its data; one setting switches to "block until consent" |
| ~~M11 · Moving to self-managed~~ | **Parked to the roadmap (owner, 2026-11-16).** See M11 below | — |
| **Release 0.2** | M7–M10; docs, beta for learners, release notes | `v0.2.0` released; monitoring shows sign-ups by account type |

### M7 · Shared core · ✅ done 2026-11-16

Built as planned, with these notes:
- `requireParent` / `requireStudent` are replaced by `requireActor()` and `requireShell("parent" | "learner")`. The shell only picks which screens to show; every server function checks `can` through `src/server/learners.ts` (`authorizeLearner`, `authorizeTrack`). The policy is `src/domain/permissions.ts`.
- The account holder is `controllerOf` in `src/domain/accounts.ts`. Codes, AI usage, the allowance and the daily limits all go through it.
- The allowance override is set with `npm run ai:allowance -- <email> <usd>` (live: `npm run live:access -- allowance <email> <usd>`). The package request form is at `/contact?topic=package` and needs `OWNER_EMAIL` on the server, which is still empty on owlrnd.com.
- Until M9, a self-managed learner's chat turns are passed to the AI as the account holder's ("Parent:" in the prompt).

1. **Schema** (additive, one migration):
   - `students`: add `type` (default `parent_managed`), `email` (unique when not null), `email_verified_at`, `date_of_birth`, `consented_at` / `consent_version` (for self-managed adults), and make `parent_id` nullable with a check that it is set exactly when `type = 'parent_managed'`.
   - `parent_links` (new): parent ↔ learner, `kind` (`manages` | `consents`), consent status, verification record, date given. Fill `manages` rows for every existing child. `students.parent_id` stays as the fast path.
   - `track_messages.author` gains `learner`; `ai_usage` gains `student_id` so a self-managed learner's spend is counted.
   - `codes`, `sessions`, `invitations`: allow a self-managed learner as the owner, using the existing `student_id` columns.
2. **One permission policy** in `src/domain/permissions.ts`: `can(actor, action, target)` with the actions from brief §2.3 (`practise`, `manageTracks`, `addPackage`, `addTopics`, `changeOwnPassword`, `viewProgress`, `manageChildren`, `deleteAccount`). It is pure and table-tested. `requireParent` and `requireStudent` (used in about 34 files) are replaced by `requireActor()` plus `can(...)` in server actions and pages. Screens hide what `can` refuses, and the server refuses it anyway.
3. **Codes to the account holder:** `issueCode` resolves the address through `controllerOf`. Rules §1 (expiry, tries, resend) don't change.
4. **Sessions:** idle timeout per type in `rules.ts`. Built as 7 days (parents, self-managed learners) and 12 hours (parent-managed); **changed back to 30 days for everyone (owner, 2026-11-16)**, so 0.2 doesn't change sign-in time from 0.1. The per-type setting stays.
5. **AI spend limit per account (demo): $10.** Every Claude call is already costed in `ai_usage`; add the account holder to each row (the parent's family, or the self-managed learner) and sum it. The $10 (`rules.aiLimits.perAccountUsd`, configurable) is a running total for the **whole demo**, not per month. At $10, new track chats and new exams pause, while marking of exams already submitted still finishes, as the monthly budget does today. The message says the demo allowance is used up and offers **Contact us to buy a package**, which opens the contact page (`/contact`) with the request filled in and emails the owner, the same way Get access requests do today. Pricing plans will be ready by then; 0.2 takes no payments. Each account can carry its own limit (an override on the account holder, set with an `npm run` script), so the owner can raise it for someone who buys a package. The account page shows how much of the allowance is used.
   - **Usage tracker in the sidebar (owner, 2026-11-15):** a small box in the side menu (`AppShell`), directly above the profile menu (below the points box where there is one). It reads "AI allowance", shows "$3.20 of $10 used" and a thin bar. The bar turns amber at 80% and red at 100%, and at 100% the box links to **Contact us to buy a package**. It's an accessible progress bar (`role="progressbar"` with a label and the values), with text at least 4.5:1 on the dark sidebar. Shown to the account holder only: a parent and a self-managed learner. A parent-managed learner doesn't see it, since the allowance is the parent's; if it runs out, their exams pause with a message to ask their parent. The figure updates on each page load. The limit shown is the account's own (so it rises when an owner raises it). The existing daily limits and the overall monthly budget (`AI_MONTHLY_BUDGET_USD`) stay as a safety net; raise the monthly budget in step with sign-ups, since open sign-up × $10 can pass $150 quickly.

### M8 · Sign-up and sign-in for both · ✅ done 2026-11-16

Built as planned, with the landing page from the owner's hand-off (`landing-handoff 3`; decisions in `10-decisions.md`). Until M9, a new learner lands on an empty Exams dashboard. Still open before release: the privacy policy and terms describe parents and children only and need learner wording (owner review, then bump `POLICIES_VERSION`); run `npm run access -- announce` at release.

- `/sign-up` opens on "Who is this account for?" (1a) with **For me** and **For my child** as two large, equal choices (real buttons, at least 44px). For my child goes to today's parent sign-up (P·1a); `/sign-up?for=child` skips straight there.
- **For me (1b, 1c):** name, email, password, date of birth, the consent checkbox, then verify email. 18 or over goes to the set-up choice (2a); under 18 goes to 1d. Until M10 ships, under-18s see "Ask a parent to help you sign up" and are not created.
- **For my child:** today's 0.1 sign-up, unchanged, with date of birth added when adding a child (2a).
- **Sign-in:** the field already reads "Username or email". Rename it to "Email or username" (brief §2.2, 3a); forgot password (5d) takes either too; route by account type to **Your students** or **Exams**; never pre-fill after sign-out.
- **Open sign-up (owner, 2026-11-15):** 0.2 removes invite-only for both paths. Set `rules.access.inviteOnly` to `false`; the landing page's "Get access" buttons become "Sign up" and go to 1a; `/get-access` redirects to sign-up. Before release, email everyone on the waiting list that sign-up is open. Keep the invitation code and the switch, so the beta can be closed again without a release.
- **Landing page** becomes the **Rank-ready** page for learners. Nothing in the header or first screen mentions parents. A **For parents** section lower down (`#parents`, "Setting this up for your child?") and a footer link go to sign-up with For my child chosen. owlrnd.com/#parents is the link to share with parents (editions §2.2).
- **Account menu** shows who is signed in on both paths: for a learner, their name and "Learner" (5a shows "JEE Main 2027", which came from a package; without packages, show the role); for a parent, as in P·5c.

### M9 · Learners set up their own tracks · ✅ done 2026-11-16

Built as planned. The parent and learner track screens are the same components (`src/components/tracks/`, `TrackChat`, `TrackUpdateChat`, `TrackCard`) with a `TrackAudience` (`src/domain/trackView.ts`) for links and wording; the server actions are shared (`src/app/_actions/tracks.ts`, `profile.ts`). The AI prompts take an audience; for a learner they are the parent prompts with fixed phrase swaps (`src/server/ai/voice.ts`), tested to contain no "parent" or "child".

- Reuse the 0.1 track chat, tracks pages and update chat, with the self-managed learner as the actor. Move them behind routes that both shells use, so the same components serve `/students/[id]/tracks/...` (parent) and `/tracks/...` (learner).
- **Set-up choice (2a), without packages (owner, 2026-11-15):** two sections, in this order (the reverse of the sm-2a mockup):
  1. **Build your own**, at the top as its own section: "Any exam, any topic. Chat with the AI and attach your syllabus, notes or a past paper." It is the only active choice and leads to 2c.
  2. **Ready-made packages**, below it as a separate section: the eight exam package cards, marked **Coming soon** and not selectable, as the parent path shows packages (P·2c).
- **The learner's sidebar has Exams and Tracks.** "Your tracks" (4.1a) is where the learner both practises and manages: + New track (no Add a package in 0.2), and per track History, Add material, Pause, Resume, Add topics to continue, Archive.
- Build your own: empty state (2c), chat (2d, 2e), track created (2f); later screens for history (2g), goal reached (2h) and add topics (2i). The dashboard (3c–3g) has no parent wording.
- **AI wording:** prompts and screen text say "you" and "your exam" to a learner and "Scout" and "your child" to a parent. Rules and limits (AI §6) stay the same: the AI stays inside the track's topics and the material the *account holder* provided.
- **Profile (learner):** change name, email (code to the new address), password; delete account and data.

### M10 · Under-18 consent (editions §2.4) · ✅ done 2026-11-16

Built as planned, with the owner's choices: "For me" from 13, and the read-only progress view stored but not built (0.2.x). Consent lives in `consent_requests` and `consent_events` (not `parent_links`, since the parent usually has no account); the request survives the learner's deletion as audit. Practice is gated through the permission policy (`practiseBlocked` on the actor). **Before launch:** legal review of practising before consent and email-only verification, and consent wording in the privacy policy.

Owner's decisions: an under-18 learner **practises straight away**, consent is collected in parallel, and in 0.2 the parent is verified by **email code only**.

- **1d:** after verifying their email, an under-18 learner gives a parent's name and email, then carries on to the set-up choice (2a). The parent's email can't be the learner's own or another learner account's email.
- **Email and 1f:** the parent gets a link (valid 7 days) to the consent page. The page sends a 6-digit code to the same email (rules §1: 10 minutes, single use, 3 tries). The parent sees what owlrnd keeps and never does, ticks the consent box, can turn on a read-only progress view (off by default), and chooses **I agree** or **Decline**. The parent gets no control over tracks.
- **1e:** while consent is pending, the learner's dashboard shows an amber "Waiting for your parent to agree" banner with Resend and Change email. Nothing else is blocked.
- **Timing (in `rules.ts`):** reminder to the parent after 3 days; link valid 7 days; after 30 days with no answer, practice pauses and the learner is asked to resend.
- **Decline** closes the learner's account and deletes its data (the same deletion as Delete account, including files).
- **Records:** `parent_links` (`consents`) with status, `verification_level` (`email_code` now; `manual` and `digilocker` later, roadmap items 13 and 14), policy version and timestamps; every request, code sent and answer kept as an audit record.
- **Switch:** `rules.consent.under18Mode` = `practise_while_pending` (default) or `block_until_consent`, changeable without code changes.
- **Read-only progress view:** the parent's choice is stored; the view itself is a small page for the parent (scores and activity, no answers). Build it last in M10, or move it to 0.2.x if time is short.
- **Before launch:** legal review of practising before consent and of email-only verification (editions §2.4).

### M11 · Moving from parent-managed to self-managed · parked (owner, 2026-11-16)

Not in 0.2; moved to the roadmap (`09-roadmap.md` item 18). The owner's account model for 0.2:
- Whoever signs up for their own practice ("For me") gets the codes at their own email; under-18s add a parent for consent (M10).
- When a parent signs up ("For my child"), the account is always the parent's: codes go to the parent and the parent sets up the tracks. A child's account isn't handed over, and the child doesn't manage tracks.

The original M11 notes, kept for the roadmap:

- The parent chooses "Let Scout manage their own practice" on 5e, or the learner turns 18 and the parent is prompted. The learner adds and verifies their own email; `type` becomes `self_managed`; the `manages` link ends; codes now go to the learner. History, tracks and points stay.
- The parent's view of that learner ends unless the learner keeps it on (that switch is built later along with the read-only view).

### Also in 0.2 · Answer sheet survives the Back button (owner, 2026-11-15)

Every recorded answer is kept automatically, so pressing the browser's Back (or Forward, or reloading) never loses work or shows an older copy of the paper. This applies to both paths and doesn't change rules §4–§5.

Today, choices save to the server at once (`saveAnswer`) and typed answers save after a short pause or when the box loses focus (`ExamPaper.tsx`). The gaps:

- **Back is a client-side navigation**, so `beforeunload` doesn't fire. A typed answer still waiting for its pause is dropped when the paper unmounts.
- **Coming back** with Back or Forward can show the paper from the router cache or the browser's back-forward cache, with the answers it had when it first loaded, not the latest saved ones. Typing then overwrites newer answers.

To build:

1. **Save on leaving:** when the paper unmounts or the page is hidden (`pagehide`, `visibilitychange`), send every pending answer at once (`navigator.sendBeacon` to a small route that uses the same `exams.saveAnswer` checks).
2. **Local copy as a safety net:** also keep each answer in `sessionStorage` (keyed by exam), written on every change. On opening the paper, use the newer of the server answer and the local copy per question, and save any newer local copy to the server. Clear it on submit. Wrap reads and writes in try/catch; the paper must work without it.
3. **Always fresh on return:** the exam page is never served from a cache (`dynamic`, no-store), and on `pageshow` with `persisted` the paper reloads its answers from the server.
4. **Submitted or expired:** coming back to a submitted exam goes to its marking or result page, never an editable paper.

Done when (Playwright): answer multiple choice and short-answer questions on both pages, press Back straight after typing, press Forward, and every answer is there; reload mid-exam and every answer is there; Back after submit lands on marking or the result.

### Also in 0.2 · A goal also needs every topic covered (owner, 2026-11-15) · ✅ done 2026-11-16

Built as below. Under today's strength rules (§4) `all_tested` gives the same result as `all_strong`; it differs only if those rules change. Release notes: active tracks follow the new rule from their next marked exam, so some keep going longer than before.

Today a track stops on its score alone (8/10 or better in 3 exams in a row). That can happen while topics are still untested or weak: a 12-topic track can reach its goal in 30 questions, about 2.5 per topic, and a student who misses the same topic every time can still score 8/10. From 0.2 the goal has two parts, and **both** must hold:

1. **Score run**, as today: X/10 or better in N exams in a row.
2. **Coverage:** every topic on the track is **strong** (rules §4: at least 80% of its last 5 questions right, with at least 3 answered).

To build:

- `goalReached` (`src/domain/goals.ts`) takes the track's topic strengths as well as the run. Marking (`src/server/marking.ts`) passes them in the same transaction it already uses for goal progress. The rule is `rules.goal.coverage` = `all_strong` (default), with `all_tested` (every topic answered at least 3 times and none still needs work) and `off` (0.1 behaviour) as settings that need no code change.
- **Which topics count:** the track's active topics. After a restart (2j), earlier topics are revision and don't count towards the new goal.
- **Exams keep aiming at the gap.** Nothing changes in the exam mix (rules §4): it already puts 80% of questions on weak and untested topics. When the score run is met but coverage isn't, the track stays active and the result screen's "Your next exam" line names the topics still to make strong.
- **Progress shows both parts** wherever goal progress appears today (2g–2i, 4.1a, 3c and the learner's sm-2f/sm-2h): "3 of 3 exams · 10 of 12 topics strong". The bar fills only when both are complete. The "goal reached" notice is unchanged.
- **The goal sentence** in the track chat and preview (2e, 2f, 2j) reads "Score 8/10 or better in 3 exams in a row, with every topic strong". The AI explains the coverage part when it proposes a goal. The account holder can still change X and N, but not switch coverage off (that is the setting).
- **Live tracks:** tracks already at `goal reached` stay stopped. Active tracks follow the new rule from the next marked exam, so a few may keep going longer than they would have. Mention it in the release notes.
- **Tests:** a run of 3 with one topic needing work → not reached; every topic strong with a run of 2 → not reached; both → reached; revision topics ignored after a restart; `off` matches 0.1.

Not in 0.2: tracking subtopics inside a chapter (the AI's topics are the finest level tracked). That belongs with subjects (roadmap item 15).

## Testing

- Unit: the permission table (every cell of §2.3), `controllerOf`, age and consent rules, session timeouts per type.
- Integration: migration on a copy of 0.1 data (parents and children keep working, nothing lost); codes go to the right email for all three types; a parent-managed learner is refused every track change at the server, not just hidden in the interface.
- Browser (Playwright): full For me journey (sign up → build your own track → exam → result), full For my child journey (unchanged from 0.1), under-18 journey (practise while pending, parent agrees, parent declines), both consent modes.
- Run the live migration against a snapshot of the production database first, and take a backup right before deploying.

## Documents to update during 0.2

`01-product.md` (two audiences), new `02-scope-0.2.md`, `03-flows.md` (learner journeys; screens are already in `04b-screens-self-managed.md`), `05-rules.md` (§1 codes to the account holder; sessions), `06-data.md` (brief §3), `07-ai.md` ("you" wording), `10-decisions.md` (brief §6 defaults), `CLAUDE.md` build order, `README.md`, the landing page, and the privacy policy (learners as account holders, under-18 consent).

## Decisions needed from the owner

| # | Question | Working default |
|---|---|---|
Settled by the owner (2026-11-15):

- **No ready-made packages in 0.2.** Only Build your own works; the package cards show as Coming soon. Screen 2b, the package catalogue and `source_package` are not built.
- **Track rules stay as in 0.1.** Every track stops at its goal and restarts when topics are added (rules §3); no chapter-by-chapter tracks. Question types stay multiple choice and short answers; no numerical-answer type.
- **Grouping tracks into a subject** is for later (roadmap item 15).
- **Exam rules settings** (negative marking and similar) are for later (roadmap item 16); 0.2 has no negative marking.
- **Open sign-up:** no invite-only in 0.2, for either path.
- **AI spend limit:** $10 per account for the whole demo, replacing the per-learner daily allowance idea. Accounts that use it up are asked to contact owlrnd to buy a package; pricing plans will be ready by then.
- Also settled: the self-managed designs (`04b-screens-self-managed.md`, `sm-*` files), the landing page (Rank-ready, parents at `#parents`), and under-18 consent (practise while pending, email code only, behind a switch).

| # | Question | Working default |
|---|---|---|
| 1 | **Pricing** | Plans to be ready before demo accounts reach $10; sold by contact, no payments in the app in 0.2. Keep limits tied to the account holder so a bought package can raise the limit with a setting |
| 2 | Brief §6 questions | Use the working defaults written there |
