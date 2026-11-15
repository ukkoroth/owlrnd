# 2. Scope of version 0.1

## In scope

**Accounts**
- Parent sign-up with name, email and password; email verification with a 6-digit code.
- One sign-in screen for parents and students; every sign-in confirmed with a 6-digit code emailed to the parent.
- Wrong or expired code handling; forgot and reset password.
- Profile menu at the bottom of the sidebar with Profile and Sign out, for both roles.
- Parent profile; student profile (read-only for the student).

**Students**
- A parent can add several students, each with name, class, username and password.
- Student added confirmation; students page with each student's last exam, weak topic and activity charts.
- Edit a student, set a new password, remove a student.

**Tracks**
- Set-up choice: "Set up from scratch" is active; "Select from packages" is shown as Coming soon.
- Create tracks with the AI in a chat: the parent describes the chapter or test and attaches photos or files of textbook pages or a syllabus; the AI proposes the track name, topics, test date and goal; the parent confirms.
- Tracks page with each track's status, scores, topic strength and goal progress.
- Pause and resume a track.
- A track's exam history with links to marked papers.
- Goal reached: the track stops; the parent adds topics in a chat to restart it with a new goal.

**Student practice**
- Dashboard with three tabs: Today (three suggested exams, 7-day bar chart, 26-week activity grid), Recent exams, All tracks.
- First-day and nothing-to-practise states.
- Your tracks page.
- Exam paper: multiple choice, short answers and typed long answers; pages sized to the window; submit warning for unanswered questions.
- Marking in progress, result, marked paper, marked written answers.
- Points total in the sidebar and a points page with levels.

## Out of scope for 0.1

These are on the roadmap (`09-roadmap.md`). Do not build them.

- Uploading photos or files of handwritten answers (0.15).
- Capturing answers with the laptop camera (0.2).
- Ready-made packages (CBSE, ICSE, packs); the set-up screen only shows them as Coming soon.
- Creating tracks from Claude through a connector; several tracks from one chat.
- Flashcards.
- Progress pages beyond the activity charts.
- College version without a parent account.
- Teacher or classroom accounts, native phone apps, payments.
