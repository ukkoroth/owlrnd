# 3. User flows

Screen codes refer to `04-screens.md` and the files in `screens/`.

## 1 · Parent signs up

1. From sign-in (3a) the parent chooses **Create a parent account**.
2. **1a Sign up:** name, email, password.
3. **1b Verify email:** a 6-digit code is emailed; the parent enters it. Wrong or expired codes behave as in rules §1.
4. On success, continue to **2a Add a student**.

## 2 · Parent adds a student and creates the first track

1. **2a Add a student:** name, class, username, password.
2. **2b Student added:** shows the sign-in details to pass on. Next: **Set up Scout's practice**, **Add another student**, or **Go to your students**.
3. **2c Set-up choice:** "Set up from scratch" (active) or "Select from packages" (Coming soon, disabled).
4. **2d Tracks: none yet:** empty state with **Create the first track**.
5. **2e Chat, start:** the AI greets the parent and asks what the child is studying; starter options; empty track preview marked Draft.
6. **2f Chat, agreed:** the parent describes the chapter and test date and attaches pages. The AI proposes a name, topics and a goal; the parent can change any of them; the preview fills in and is marked Ready.
7. **2g First track created:** the tracks page with the new track (no exams yet, all topics untested, goal 0 of 3). The first exam appears on the student's dashboard.

Later moments in the same area:

- **2h Exam history:** from a track card, the parent sees every exam in that track and can open each marked paper (4.1f).
- **2i Goal reached:** the track shows "Goal reached · stopped" with **Add topics to continue**.
- **2j Add topics:** a chat that adds new material, keeps earlier topics as revision and sets a new goal. The track becomes active again.
- **2k Your students:** each student card with last exam, weak topic, 7-day bar chart and 26-week activity grid; links to Tracks, Set up, Edit.

## 3 · Signing in, then the student dashboard

1. **3a Sign in:** username or email and password. Same screen for parents and students.
2. **3b Sign-in code:** a 6-digit code is emailed to the parent. A student asks their parent for it. Students go to **3c**; parents go to **2k**.
3. **3c Dashboard, Today:** three suggested exams (the first highlighted), "1 completed today", 7-day bar chart, 26-week activity grid. When an exam is finished a new suggestion takes its place.
4. **3d Recent exams** and **3e All tracks** are the other two tabs.
5. **3f First day:** one exam, 0 points, a short "how it works".
6. **3g Nothing to practise:** every track has reached its goal or is paused.

## 4 · Practising an exam

1. From Today or **4.1a Your tracks**, the student presses **Start**.
2. **4.1b Exam paper:** the questions as a printed paper. Long papers split across pages (4.2a, 4.2b, 4.2c) with Next and Previous; Submit only on the last page.
3. **4.1c Submit warning** if any question is blank: go back, or submit anyway.
4. **4.1d Marking in progress** while typed answers are marked.
5. **4.1e Result:** score, points earned, strengths, needs work, what the next exam will focus on.
6. **4.1f Marked paper** and **4.1g Marked written answers**.

## 5 · Profile, sign-out and account help

- The profile button at the bottom of every sidebar opens a menu with **Profile** and **Sign out** (5a student, 5c parent).
- **5b Student profile:** username, points; password is managed by the parent.
- **5d Parent profile:** name, email, password, students, sign out, delete account.
- **5e Edit or remove a student:** change details, set a new password, remove.
- **5f Wrong or expired code**, **5g Forgot password**, **5h Reset password**.
