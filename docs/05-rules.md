# 5. Business rules

These rules are the source of truth. Values marked **(default)** are working defaults listed in `10-decisions.md`; keep them configurable.

## §1 Accounts and sign-in

**Roles.** Two roles: parent and student. A parent has many students. A student belongs to exactly one parent.
From 0.2 (editions §2.3) a student (learner) is either **parent-managed** (as below) or **self-managed**: they sign in with their own email, receive their own codes and control their own tracks. The **account holder** is whoever controls an account: the parent for a parent-managed learner, the learner themselves when self-managed. One email belongs to one account, parent or self-managed learner, never both *(owner, 2026-11-16)*.

**Sign-up** *(0.2)*. The first screen asks **Who is this account for?** (sm-1a): **For me** creates a self-managed learner, **For my child** a parent account. Sign-up is open to everyone (no invitation needed); `rules.access.inviteOnly` can close it again.

**Learner sign-up ("For me").**
- Name, email, password and date of birth, and agreement to the terms and privacy policy (recorded with the policy version).
- 18 or over **(default)**: the account is made and the email verified with a 6-digit code, as for parents.
- 13 to 17 *(M10; 13 is the owner's minimum, 2026-11-16)*: the account is made too, and after verifying the learner gives a parent or guardian's name and email (sm-1d). Under 13: no account; a parent sets it up ("For my child").

**Parent consent for under-18 learners** *(0.2, editions §2.4)*.
- The parent is emailed a link, valid 7 days **(default)**, and reminded once after 3 days **(default)**. The parent needs no account. Opening the link sends a 6-digit code to the parent's email (same rules as codes below); the parent ticks the consent box and chooses **I agree** or **Decline**. Both answers need the code. The parent can also ask for a read-only progress view (stored; the page comes later). The parent gets no control over tracks.
- The parent's email can't be the learner's own or another learner account's.
- While consent is pending the learner practises as normal **(default: `practise_while_pending`)**, with a banner offering Resend and Change email. With no answer 30 days **(default)** after the first request, practice pauses (no exams opened or written) until a parent agrees. The setting `block_until_consent` pauses practice until consent instead.
- **Decline** closes the learner's account and deletes its data, as Delete account does. Every request, code, reminder and answer is kept as an audit record, without practice data.
- The email can't belong to a parent or another learner (one email, one account).

**Parent sign-up.**
- Name, email and password. Password at least 8 characters **(default)**.
- After sign-up, a 6-digit code is emailed to verify the address. The account cannot be used until it is verified.

**Students.**
- Created only by their parent: name, class, date of birth *(0.2; 3 to 18 years old **(default)**)*, username and password. No email.
- Usernames are unique across the whole app.
- A student cannot change their own password; the parent sets a new one on the edit screen (5e) or the student uses "Forgot password" (5g), which also sends the code to the parent.

**Sign-in (every account type).**
1. One screen (3a): "Email or username", plus password. Parents and self-managed learners use their email; parent-managed learners their username. After signing out, nothing is pre-filled.
2. If they are correct, a new 6-digit code is emailed to the **account holder's** email: for a parent, their own; for a parent-managed student, their parent's; for a self-managed learner, their own.
3. The code screen (3b) shows that email masked (for example `u•••@example.com`). For parent-managed students the text says to ask their parent for the code; a self-managed learner is told it went to their own email.
4. On success, a parent lands on Your students (2k) and a student on their dashboard (3c).

**Codes** (verification, sign-in, password reset).
- 6 digits, single use, valid for 10 minutes **(default)**.
- A new code makes earlier unused codes invalid.
- Wrong code: show an error with the tries left. After 3 wrong tries **(default)** the code is invalidated and a new one is sent automatically (5f).
- "Send a new code" is available at any time; limit resends to 5 per hour **(default)**.

**Password reset** (5g, 5h). Enter username or email; a reset code goes to the account holder's email; enter the code and a new password twice.

**Sign-out.** From the profile menu at the bottom of the sidebar (5a, 5c). It ends the session on that device.

**Staying signed in.** A session ends at Sign out, or after 30 days without use, for every account type **(default; owner, 2026-11-16)**. Using the app restarts the clock.

**Email change** (parent). Needs a code sent to the new address before it takes effect.

**Remove a student** (5e). Deletes the student's account, tracks, exams and points after a confirmation. It cannot be undone.

## §2 Tracks

- A track belongs to one student. Its name includes the subject, for example "Physics: Current electricity" or "Maths: Quadratic equations".
- A track has: name, topics (found by the AI from the parent's material), the material itself (messages and attached files), optional test date, goal, and status.
- **Status:** `active`, `paused` (by the parent) or `goal reached` (stopped).
- Only active tracks produce new exams. Paused and goal-reached tracks keep their history.
- The parent creates tracks in the AI chat (2e, 2f). Nothing goes live until the parent confirms.
- **Create track** works as soon as the preview has a name, at least one topic and a goal (the test date is optional), whether or not the chat has finished agreeing it; the parent can create it then or keep refining. Until then the preview card marks what's still needed in red (owner, 2026-11-16).
- Pause and resume are parent actions. *(2026-11-18, roadmap 22)* **Archive** works on any track (active, paused or goal reached): it leaves the learner's dashboard, suggestions and lists, keeps its history, and discards an exam that is ready or in progress (the confirmation says so). **Restore** puts an archived track back to the status it had; an active one gets its next exam written. **Delete** removes a track for good (topics, chat and material with their files, exams, answers, flashcards) after a confirmation that names it; points already earned stay. Only the controlling account can do these.
- "Select from packages" is not available in 0.1; show it as Coming soon (2c).

## §3 Goals

- Every track has one goal of the form **"score X / 10 or better in N exams in a row, with every topic strong"**. Suggested default: X = 8, N = 3 **(default)**. The parent can change X and N in the chat.
- Goal progress counts consecutive qualifying exams in that track and resets to 0 on an exam below X.
- **Coverage (0.2, owner 2026-11-15):** every active topic on the track must also be strong (§4). Revision topics after a restart don't count. Setting: `all_strong` **(default)**, `all_tested` (each topic answered at least 3 times and none needs work) or `off` (score run only, as in 0.1).
- When progress reaches N **and** coverage holds, the track's status becomes `goal reached`: it stops producing exams, the student sees "Goal reached" with no Start button, and the parent sees "Add topics to continue".
- **Restarting** (2j): the parent adds material in a chat; the AI finds the new topics; earlier topics stay as revision (about 2 questions per exam **(default)**); the parent agrees a new goal; status returns to `active` with progress 0.

## §4 Building exams (adaptivity)

Adaptivity happens **between** exams. The whole paper is shown at once and does not change while the student answers.

- An exam has at most **10 questions**.
- **Question types in 0.1:** multiple choice (4 options, one correct), short answer (a word or one sentence), and long typed answer (a few sentences).
- **Topic strength** per student per topic: `strong`, `needs work` or `not tested`. A topic is strong when at least 80% of its last 5 questions were answered correctly, with at least 3 answered **(default)**.
- **First exam in a track:** covers every topic about evenly.
- **Later exams:** about 50% weak topics, 30% not-tested topics and 20% strong topics as repeats **(default)**. When there are no weak or untested topics, fill with strong topics at a slightly harder level.
- A question the student missed may come back, reworded, in a later exam. Do not repeat an identical question within 3 exams **(default)** unless it is a deliberate retry of a miss.
- *(2026-11-18, owner; roadmap 23)* **Question pool.** Exam 1 of a track is written on its own. After it is marked, questions are written in batches (about 2 exams' worth, at most 20 per call, **defaults** in `rules.pool`) and each later exam is **picked** from the track's unused questions with the mix above, so it is ready at once. The pool is topped up in the background when fewer than 10 unused questions remain or 5 misses are waiting for new words.
  - A question the student got right never comes back. A missed one comes back only in **new words** (written in the next top-up), and not within 3 exams of the original. Its exact wording is never asked again.
  - Picking from questions already written uses no AI, so exams carry on while the AI allowance or monthly budget is used up, until the pool runs out; then the next exam is on hold as before.
- Questions stay within the track's topics and material and at the student's class level (see AI §6).
- The result screen states what the next exam will focus on, using these rules.

## §5 Exam paper layout

- An exam page is never taller than the browser window; **the page never scrolls**.
- Questions are laid out at normal size, measured, and placed page by page until the next one would overflow. Do not use a fixed number per page.
- A question never splits across pages; it stays with all its options or its answer box.
- Text is never shrunk below 16px to make questions fit; move them to the next page instead.
- On window resize, page the questions again, keep every answer, and keep the student on the page holding the question they were on.
- Show "Page X of Y" at the bottom left, with Next and Previous beside Submit. **Submit appears only on the last page.**
- Question numbers run continuously across pages.
- Answers are kept when moving between pages and if the student leaves and returns before submitting.
- **Submitting with blank questions** shows a warning naming them (4.1c). Blank answers count as wrong.

## §6 Marking

- Multiple choice is marked immediately.
- Short answers accept reasonable spelling mistakes and equivalent wording; the AI judges equivalence against the expected answer.
- Long typed answers are marked by the AI against a list of key points, with partial marks.
- While typed answers are being marked, the student sees "Marking your answers" (4.1d) and may leave; the result appears on the dashboard when ready.
- **Score:** each question carries marks (multiple choice and short answers 1 mark; long answers 2 or 3 marks **(default)**). The score shown is out of 10, scaled from total marks and rounded to the nearest whole number **(default)**.
- The marked paper (4.1f) shows the correct answer, the student's wrong answer and a one-line reason for each miss. Marked written answers (4.1g) show a verdict, marks, what a full answer includes and short feedback.
- After marking, update topic strength (§4), goal progress (§3) and points (§8).

## §7 Suggestions on the Today tab

- Show up to 3 suggested exams, at most one per track.
- Only active tracks are eligible.
- Order **(default)**: the track with the nearest upcoming test date first; then tracks not practised for the longest time; then the track with the most weak topics.
- When the student finishes a suggested exam, a new suggestion takes its place, so a keen student can keep practising.
- Show "N completed today".
- **First day** (3f): no exams taken yet; show the one available exam and a short explanation.
- **Nothing to practise** (3g): no active tracks; list each track with its status.

## §8 Points and levels

Points reward effort and improvement more than raw marks. Points only add up; they are never spent or taken away.

| Event, per exam | Points |
| --- | --- |
| Finish an exam | 10 |
| Each correct answer | 2 (up to 20) |
| Each extra correct answer compared with the last exam in the same track | 5 |
| A weak topic becomes strong | 10 each |
| A perfect 10 / 10 | 10 extra |
| First exam of the day, when the student also practised the day before | 5, or 10 from day 7 of an unbroken streak |
| Finish a flashcard session of 8 or more cards *(0.3)* | 5, for at most 2 sessions a day in each track **(default)**; none per card |

- Full points apply to the first 5 exams a day **(default)**; after that only correct answers score.
- Worked example: 8 / 10, up from 6 last time, on day 4 of a streak: 10 + 16 + (2 × 5) + 5 = **41 points**.
- The result screen shows the breakdown; the points page shows today's breakdown and the rules.

**Levels** (by total points) **(default thresholds)**:

| Level | Points |
| --- | --- |
| Explorer | 500 |
| Trailblazer | 2,000 |
| Champion | 5,000 |
| Mastermind | 10,000 |
| All-rounder | 20,000 |

The sidebar shows the total and current level on every student screen. The parent sees the same total and level.

## §9 Activity charts

- Count **completed exams per day** in the student's time zone.
- **7-day bar chart:** the last 7 days ending today; the count above each bar; today highlighted.
- **26-week activity grid:** one square per day for the last 26 weeks, weeks as columns, days as rows, today outlined. Five shades for 0, 1, 2, 3 and 4 or more exams.
- Shown on the student's Today tab (3c) and on each student card on the parent's students page (2k). Both show the same data. *(2026-11-18, owner)* On the Today tab they show from the student's first day (3f), empty until the first exam, once the student has a track.
- *(2026-11-18, owner)* **Overall scores chart** at the top of Recent exams (3d), once an exam is marked: one bar per marked exam across all tracks (the latest 50, oldest first), score out of 10, all in one colour, the track named in each bar's tooltip; above it the number of marked exams, the average score and, after more than 5 exams, the average of the last 5 (one decimal); below it each track's labelled tag with its exam count, average and latest score, the most practised first.
- *(0.3)* Flashcard sessions (with at least one card answered) show on the 7-day chart as a separate, narrower teal series with a legend, only when there were any that week. They are never counted as exams: not in the 26-week grid, "exams completed", streaks or exam numbers.

## §9a Flashcards *(0.3)*

Practice, not assessment: flashcards never change an exam score, topic strength, goal progress or streak. Details and defaults: `docs/plan-0.3-flashcards.md` and `rules.flashcards`.

- **Deck:** about 6 cards per active topic when a track starts (up to 60), up to 3 cards from missed questions after each marked exam, top-ups of 10; at most 200 per track.
- **Session:** up to 10 due cards, lower boxes and weaker topics first; with none due, a top-up is written first. Running and goal-reached tracks only (not paused or archived).
- **Spacing (Leitner):** Got it moves a card up a box (1–5), Not yet back to box 1; due again after 1, 2, 4, 8 or 16 days. "Known" = box 4 or higher.
- **Practise · N flashcards:** N = cards due now, up to 10; with none due, the top-up size, shown as "N new flashcards"; no button while the starter deck is still being written (the first exam comes first) or when nothing is due and the deck is full.
- **Exams and cards rarely repeat each other's wording** (at most one near-copy per paper or batch after one rewrite; AI §7).
- **Points:** see §8.
- **The parent sees** a child's flashcard activity, not the cards: sessions in the last 7 days and cards known, on 2k and per track.

## §10 Permissions

From 0.2 the full table, with self-managed learners, is editions §2.3, enforced by one policy (`src/domain/permissions.ts`). For a parent and a parent-managed student it matches the table below.

| Action | Parent | Student |
| --- | --- | --- |
| Add, edit or remove students | Yes | No |
| Create, pause, resume, archive, restore, delete tracks; add topics; set goals | Yes | No |
| Take exams | No | Yes |
| See results, marked papers, points, activity | Yes, for their own students | Yes, their own |
| Change password | Own; sets students' passwords | Through "Forgot password" only |
