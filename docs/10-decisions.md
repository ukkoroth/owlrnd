# 10. Open decisions and working defaults

Use the default until the owner decides. Keep each one configurable.

| Topic | Working default | Rules |
| --- | --- | --- |
| Technology stack | Not decided. Confirm with the owner before starting. | none |
| Goal form | "X / 10 or better in N exams in a row", X = 8, N = 3; parent can change | §3 |
| Strong topic | At least 80% of its last 5 questions correct, with at least 3 answered | §4 |
| Topic mix per exam | 50% needs work, 30% not tested, 20% strong repeats | §4 |
| Revision after adding topics | About 2 questions per exam from earlier topics | §3 |
| Repeat window | No identical question within 3 exams, except a deliberate retry of a miss | §4 |
| Marks per question | Multiple choice and short answers 1; long answers 2 or 3 | §6 |
| Score shown | Out of 10, scaled from marks, rounded | §6 |
| Suggestion order | Nearest test date, then longest since practice, then most weak topics | §7 |
| Code expiry, tries, resends | 10 minutes; 3 tries; 5 resends per hour | §1 |
| Password minimum | 8 characters | §1 |
| Points values and daily cap | As in the table in §8; full points for the first 5 exams a day | §8 |
| Level thresholds | 500, 2,000, 5,000, 10,000, 20,000 | §8 |
| Time zone for "today" | The student's time zone, set from the parent's device at sign-up | §9 |
| What Archive does | Hides a goal-reached track from the student; history kept | §2 |
| Session length *(owner, M1)* | Signed in until Sign out, or 30 days without use (sliding) | §1 |
| Forgot password, unknown account *(owner, M1)* | Say "We couldn't find that username or email." | §1 |
| Code scope | A new code cancels earlier unused codes for the same person and purpose only (a student's sign-in code doesn't cancel the parent's or a sibling's); the 5-per-hour limit is counted the same way | §1 |
| Wrong passwords | 10 failed sign-ins for a username or email within 15 minutes pauses sign-in for it | §1 |
| Password change or reset | Signs out other devices | §1 |
| Parent sets a student's password *(owner, M2)* | Signs the student out of every device straight away | §1 |
| Class | Free text; a bare number is shown as "Class N" ("10" → "Class 10") | §1 |
| Student usernames | 3–30 characters: letters, digits, dot, dash, underscore; never "@"; unique across the app ignoring case | §1 |
| Pronouns | The app doesn't know a child's pronouns, so wording uses the child's name or "they" (the mockups' "him/his" is sample text) | none |
| Question types *(owner, M3)* | Multiple choice and short answers only in 0.1; no long typed answers (screens 4.1g, 4.2c and key-point marking unused for now). At least half of each exam is multiple choice | §4, §6 |
| Track chat drafts | The chat is saved as a draft track (never shown to the student), so leaving and coming back keeps it; "Start over" deletes it | §2 |
| Creating a track | Only the parent's "Create track" button makes a track live, and only once the AI marks the preview as agreed and it has a name, 1–12 topics and a goal | §2 |
| Photos in the chat | Resized in the browser to at most 2000 px (JPEG) before upload; up to 10 files per message; PDFs up to 15 MB. Each photo is sent to Claude once; later turns use the text read from it | AI §1 |
| First exam | Written in the background as soon as the track is created: up to 10 questions spread evenly over the topics (more than 10 topics: the first 10, the rest next time) | §4 |
| Paper reading order *(owner, M4)* | Two columns on wide screens, read down the left column then the right (as in 4.1b); one column below 1024 px | §5 |
| Section headings | When a paper has both kinds of question: "Section A · Choose one answer" and "Section B · Write a word or one sentence"; each heading moves with its first question | §5 |
| Leaving an exam | Answers are saved as the student works; "Leave exam" returns to the dashboard and the exam shows "Continue". No time limit | §5 |
| M4/M5 split | M4 ends at "submitted"; marking, the score, points and writing the next (adaptive) exam come in M5 | §4, §6 |
| Topic strength with few answers *(owner, M5)* | Strong: ≥ 80% of the last 5 with ≥ 3 answered. Needs work: any miss and not strong. Not tested: nothing answered, or only 1–2 answered and all right | §4 |
| This exam's strengths (4.1e) | A topic counts as a strength in an exam at ≥ 80% of its questions in that exam | §6 |
| Short-answer marking | Blank → wrong; same as the expected answer (ignoring case, spaces, punctuation) → right without the AI; anything else → the AI, one call per exam, with a one-line reason for each miss | §6, AI §4 |
| Retries | Up to 2 questions missed in the last exam (on topics that still need work) come back reworded; no question is repeated word for word within 3 exams | §4 |
| Next exam | Written in the background right after marking, unless the track is paused or has reached its goal; resuming a paused track writes it then | §2, §3, §4 |
| Add material on an active track *(owner, M6)* | Through the chat: the AI explains how the plan changes (new topics from the next exam on, goal kept or changed) and nothing changes until the parent presses Apply changes. The goal and its progress stay unless the parent changes the goal, which restarts progress at 0 | §2, §3 |
| Goal progress after a restart | Counts only exams after the restart (`goal_since_exam`), so earlier qualifying exams don't count towards the new goal | §3 |
| Archive | Only goal-reached tracks; hidden from the student, history kept and shown to the parent under "Archived tracks"; no un-archive in 0.1 | §2 |
| Activity grid weeks | Sunday at the top of each column (Mon / Wed / Fri labelled); on narrow screens it scrolls and opens on the latest weeks | §9 |
