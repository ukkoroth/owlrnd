# 4. Screens

Every screen in version 0.1, in the order of the design canvas. Screenshots are 1280px wide. "Leads to" lists the screens each screen links to.

## 1 · Parent signs up

| Code | Screen | Purpose | Details | Leads to | Files |
| --- | --- | --- | --- | --- | --- |
| 1a | Sign up | Parent creates an account. | Name, email, password. Left panel lists the three set-up steps. Leads to 1b. | 1b, 3a | [png](../screens/1a_sign-up.png) · [html](../mockups/1a_sign-up.html) |
| 1b | Verify email | Parent confirms their email with a 6-digit code. | Code valid 10 minutes, single use. Resend and "Use a different email". Leads to 2a. | 2a, 1a | [png](../screens/1b_verify-email.png) · [html](../mockups/1b_verify-email.html) |

## 2 · Parent adds a student and creates tracks

| Code | Screen | Purpose | Details | Leads to | Files |
| --- | --- | --- | --- | --- | --- |
| 2a | Add a student | Parent adds a student. | Name, class, username, password (shown so the parent can pass it on). Leads to 2b. | 2b | [png](../screens/2a_add-a-student.png) · [html](../mockups/2a_add-a-student.html) |
| 2b | Student added | Confirms the student was added and shows their sign-in details. | Notes that every sign-in sends a code to the parent. Actions: set up practice (2c), add another student (2a), go to students (2k). | 2c, 2a, 2k | [png](../screens/2b_student-added.png) · [html](../mockups/2b_student-added.html) |
| 2c | Set up Scout's practice | Parent chooses how to set up the student's practice. | "Set up from scratch" is active and leads to 2d. "Select from packages" is shown as Coming soon and disabled. | 2k, 5d, 3a, 2d | [png](../screens/2c_set-up-scout-s-practice.png) · [html](../mockups/2c_set-up-scout-s-practice.html) |
| 2d | Tracks: none yet | Empty tracks page before the first track exists. | Explains what a track is and how creation works. "Create the first track" opens 2e. *(2026-11-18)* Below it, "Try a sample track" adds The Solar System, written in advance with its first exam ready at once; back here with the track created. | 2k, 5d, 3a, 2e | [png](../screens/2d_tracks-none-yet.png) · [html](../mockups/2d_tracks-none-yet.html) |
| 2e | Create the first track: start of the chat | Start of the AI chat that creates a track. | AI greeting, three starter options, message box with Attach file and Take photo (for textbook pages), and an empty track preview marked Draft with a disabled Create track button. | 2k, 5d, 3a, 2d | [png](../screens/2e_create-the-first-track-start-of-the-chat.png) · [html](../mockups/2e_create-the-first-track-start-of-the-chat.html) |
| 2f | Create the first track: agreed, with a goal | The same chat once the track is agreed. | Parent attached pages and changed the suggested goal. Preview shows name, topics, exam size, test date and goal, marked Ready. | 2k, 5d, 3a, 2d, 2g | [png](../screens/2f_create-the-first-track-agreed-with-a-goal.png) · [html](../mockups/2f_create-the-first-track-agreed-with-a-goal.html) |
| 2g | First track created | Tracks page right after the first track is created. | Confirmation line, one track card with no exams yet, all topics untested and goal progress 0 of 3. "New track" button. | 2k, 5d, 3a, 2f | [png](../screens/2g_first-track-created.png) · [html](../mockups/2g_first-track-created.html) |
| 2h | Later: a track's exam history | A track's exam history for the parent. | Goal progress, then a table of exams with date, score, strong topics, weak topics and a link to each marked paper. Add material, Pause track. | 2k, 5d, 3a, 2i, 4.1f, 2j | [png](../screens/2h_later-a-track-s-exam-history.png) · [html](../mockups/2h_later-a-track-s-exam-history.html) |
| 2i | Later: a track reaches its goal | Tracks page later, when one track has reached its goal. | Reached card: "Goal reached · stopped", full goal bar, "Add topics to continue" (2j) and Archive. Active card with Exam history (2h), Add material and Pause. | 2k, 5d, 3a, 2f, 2j, 2h | [png](../screens/2i_later-a-track-reaches-its-goal.png) · [html](../mockups/2i_later-a-track-reaches-its-goal.html) |
| 2j | Add topics to start the track again | Chat that adds topics to a finished track and sets a new goal. | Earlier topics stay as revision. Side panel summarises new topics, revision topics, new goal and previous goal; status Active again. | 2k, 5d, 3a, 2i | [png](../screens/2j_add-topics-to-start-the-track-again.png) · [html](../mockups/2j_add-topics-to-start-the-track-again.html) |
| 2k | Your students | Parent's home: one card per student. | Last exam, weak topic, 7-day bar chart, 26-week activity grid; links to Tracks, Set up (2c) and Edit (5e). Add student. | 5d, 3a, 2a, 2g, 2c, 5e | [png](../screens/2k_your-students.png) · [html](../mockups/2k_your-students.html) |

## 3 · Signing in and the student dashboard

| Code | Screen | Purpose | Details | Leads to | Files |
| --- | --- | --- | --- | --- | --- |
| 3a | Sign in | One sign-in for parents and students. | Username or email, password. "Forgot password?" (5g). "Create a parent account" (1a). Leads to 3b. | 1a, 3b, 5g | [png](../screens/3a_sign-in.png) · [html](../mockups/3a_sign-in.html) |
| 3b | Sign-in code | Every sign-in is confirmed with a code emailed to the parent. | Student wording: "Ask your parent for the code". Students go to 3c, parents to 2k. | 1a, 3a | [png](../screens/3b_sign-in-code.png) · [html](../mockups/3b_sign-in-code.html) |
| 3c | Dashboard: Today | Student dashboard, Today tab (the student's home). | Three suggested exams, the first with a filled button; "1 completed today"; a new suggestion replaces a finished one. 7-day bar chart and 26-week activity grid. Sidebar shows the points total. | 4.3a, 5b, 3a, 4.1b, 4.1e, 4.1a | [png](../screens/3c_dashboard-today.png) · [html](../mockups/3c_dashboard-today.html) |
| 3d | Dashboard: Recent exams | Dashboard, Recent exams tab. | The overall scores chart for all exams (rules §9), then exams newest first, grouped by day: score, track, exam number, strong and needs-work summary, link to the result. | 3c, 4.3a, 5b, 3a, 4.1b, 4.1e, 4.1a | [png](../screens/3d_dashboard-recent-exams.png) · [html](../mockups/3d_dashboard-recent-exams.html) |
| 3e | Dashboard: All tracks | Dashboard, All tracks tab. | Exams ready to take with Start; needs-work topics across tracks; one tile per track with topic strength. | 3c, 4.3a, 5b, 3a, 4.1b, 4.1e, 4.1a | [png](../screens/3e_dashboard-all-tracks.png) · [html](../mockups/3e_dashboard-all-tracks.html) |
| 3f | Dashboard: first day | Student's first day. | One exam ready, 0 points (first level at 500), a short "how it works". The activity charts, empty until the first exam (2026-11-18). | 3c, 4.3a, 5b, 3a, 4.1b | [png](../screens/3f_dashboard-first-day.png) · [html](../mockups/3f_dashboard-first-day.html) |
| 3g | Dashboard: nothing to practise | Nothing to practise. | Every track has reached its goal or is paused; lists each track with its status and says the parent can add topics. | 3c, 4.3a, 5b, 3a | [png](../screens/3g_dashboard-nothing-to-practise.png) · [html](../mockups/3g_dashboard-nothing-to-practise.html) |

## 4.1 · Practising an exam

| Code | Screen | Purpose | Details | Leads to | Files |
| --- | --- | --- | --- | --- | --- |
| 4.1a | Your tracks | Student's list of tracks. | Per track: status, score bars, topic strength, needs work, goal progress, Start button. Paused and goal-reached tracks have no Start button. | 3c, 4.3a, 5b, 3a, 4.1b | [png](../screens/4-1a_your-tracks.png) · [html](../mockups/4-1a_your-tracks.html) |
| 4.1b | Exam paper | Exam paper on one page. | Serif paper style, questions in two columns, multiple choice and short answers. Submit leads to 4.1c when questions are blank. | 3c, 4.1c | [png](../screens/4-1b_exam-paper.png) · [html](../mockups/4-1b_exam-paper.html) |
| 4.1c | Submit with unanswered questions | Warning before submitting an incomplete paper. | Names the blank questions; "Go to question 8" or "Submit anyway" (4.1d). | 3c, 4.1e, 4.1b, 4.1d | [png](../screens/4-1c_submit-with-unanswered-questions.png) · [html](../mockups/4-1c_submit-with-unanswered-questions.html) |
| 4.1d | Marking in progress | Marking in progress after submitting. | Steps: multiple choice marked, reading written answers, result. The student may leave; the result will be on the dashboard. | 3c, 4.1e | [png](../screens/4-1d_marking-in-progress.png) · [html](../mockups/4-1d_marking-in-progress.html) |
| 4.1e | Exam result | Exam result. | Score out of 10, points earned with breakdown, strengths, needs work, what the next exam will focus on. Links: marked paper (4.1f), written answers (4.1g), back to tracks. | 3c, 4.3a, 5b, 3a, 4.1f, 4.1g, 4.1a | [png](../screens/4-1e_exam-result.png) · [html](../mockups/4-1e_exam-result.html) |
| 4.1f | Marked paper | Marked paper. | Every question with tick or cross, the correct answer filled, the wrong answer ringed red, a one-line reason for each miss. | 4.1e, 3c | [png](../screens/4-1f_marked-paper.png) · [html](../mockups/4-1f_marked-paper.html) |
| 4.1g | Marked written answers | Marked written answers. | Per typed answer: verdict (correct, partly correct, missed), marks, the student's answer, what a full answer includes, short feedback. | 4.1e, 3c | [png](../screens/4-1g_marked-written-answers.png) · [html](../mockups/4-1g_marked-written-answers.html) |

## 4.2 · Exam formats in 0.1

| Code | Screen | Purpose | Details | Leads to | Files |
| --- | --- | --- | --- | --- | --- |
| 4.2a | Two-page paper, long questions | Two-page paper for long questions. | Page 1 of 2 with "Next page"; Submit appears only on the last page. | 3c, 4.1e | [png](../screens/4-2a_two-page-paper-long-questions.png) · [html](../mockups/4-2a_two-page-paper-long-questions.html) |
| 4.2b | Mixed paper, page 1: multiple choice | Mixed paper, page 1: multiple choice. | Fits the window; "Next page". | 3c, 4.1d | [png](../screens/4-2b_mixed-paper-page-1-multiple-choice.png) · [html](../mockups/4-2b_mixed-paper-page-1-multiple-choice.html) |
| 4.2c | Mixed paper, page 2: typed long answers | Mixed paper, page 2: typed long answers. | Answer boxes for a few sentences; "Previous page" and Submit. | 3c, 4.1d | [png](../screens/4-2c_mixed-paper-page-2-typed-long-answers.png) · [html](../mockups/4-2c_mixed-paper-page-2-typed-long-answers.html) |

## 4.3 · Points and levels

| Code | Screen | Purpose | Details | Leads to | Files |
| --- | --- | --- | --- | --- | --- |
| 4.3a | Points page | Points page. | Total, current level and progress to the next, points earned today with breakdown, the five levels, and how points are earned. | 3c, 5b, 3a | [png](../screens/4-3a_points-page.png) · [html](../mockups/4-3a_points-page.html) |

## 5 · Profile, sign-out and account help

| Code | Screen | Purpose | Details | Leads to | Files |
| --- | --- | --- | --- | --- | --- |
| 5a | Student menu: Profile or Sign out | Student profile menu open. | Profile button at the bottom of the sidebar opens Profile and Sign out. | 3c, 4.3a, 5b, 3a, 4.1b, 4.1e, 4.1a | [png](../screens/5a_student-menu-profile-or-sign-out.png) · [html](../mockups/5a_student-menu-profile-or-sign-out.html) |
| 5b | Student profile | Student profile. | Username, password (managed by the parent), points. Sign out. | 3c, 4.3a, 3a | [png](../screens/5b_student-profile.png) · [html](../mockups/5b_student-profile.html) |
| 5c | Parent menu: Profile or Sign out | Parent profile menu open. | Same menu as 5a, on the parent side. | 2k, 5d, 3a, 2a, 2g, 2c | [png](../screens/5c_parent-menu-profile-or-sign-out.png) · [html](../mockups/5c_parent-menu-profile-or-sign-out.html) |
| 5d | Parent profile | Parent profile. | Name, email (changing it needs a code to the new address), password, students with Edit, sign out, delete account. | 2k, 3a, 5e, 2a | [png](../screens/5d_parent-profile.png) · [html](../mockups/5d_parent-profile.html) |
| 5e | Edit or remove a student | Edit or remove a student. | Details, set a new password, remove (cannot be undone). | 2k, 5d, 3a | [png](../screens/5e_edit-or-remove-a-student.png) · [html](../mockups/5e_edit-or-remove-a-student.html) |
| 5f | Wrong or expired code | Wrong or expired code. | Error message with tries left; Send a new code; Back to sign in. | 1a, 3c, 3a | [png](../screens/5f_wrong-or-expired-code.png) · [html](../mockups/5f_wrong-or-expired-code.html) |
| 5g | Forgot password | Forgot password. | Username or email; a reset code is sent to the parent. Leads to 5h. | 1a, 5h, 3a | [png](../screens/5g_forgot-password.png) · [html](../mockups/5g_forgot-password.html) |
| 5h | Reset password | Reset password. | Code, new password twice; Save and sign in. | 1a, 3a | [png](../screens/5h_reset-password.png) · [html](../mockups/5h_reset-password.html) |

## Later versions (do not build in 0.1)

| Code | Screen | Purpose | Details | Leads to | Files |
| --- | --- | --- | --- | --- | --- |
| 0.15a | Written answers, uploaded | Later version 0.15: upload written answers. Do not build in 0.1. | Section B answered on paper; upload photos or a PDF. | 3c, 4.1e | [png](../screens/0-15a_written-answers-uploaded.png) · [html](../mockups/0-15a_written-answers-uploaded.html) |
| 0.2a | Camera capture popup | Later version 0.2: camera capture. Do not build in 0.1. | Popup with the laptop camera view; one page per capture. | 3c, 4.1e | [png](../screens/0-2a_camera-capture-popup.png) · [html](../mockups/0-2a_camera-capture-popup.html) |
