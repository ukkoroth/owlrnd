# 4b. Screens: self-managed learners

The screens for self-managed learners, from the canvas page **MVP · Competitive exams**. Sample learner: Rancho, preparing for JEE Main 2027. Files are prefixed `sm-` so they never clash with the parent screens. Screenshots are 1280px wide; the HTML snapshots link to each other.

Screens that say "Same as parent …" behave exactly like the screen with that code in `04-screens.md`, except that the learner is in control (see `11-editions.md` §2.3).


## 1 · Sign up: who the account is for, and parent consent for under-18s

| Code | Screen | Purpose | Details | Leads to | Files |
| --- | --- | --- | --- | --- | --- |
| 1a | Who is this account for? | Choose who the account is for. | Two equal choices. "For me" leads to 1b. "For my child" leads to the parent sign-up (parent screen 1a). There is no tick box. Left panel uses the Rank-ready headline. | 1b, P·1a, 3a | [png](../screens/sm-1a_who-is-this-account-for.png) · [html](../mockups/sm-1a_who-is-this-account-for.html) |
| 1b | Sign up: for me | A self-managed learner creates an account. | Name, email, password, date of birth. "← For me · change" goes back to 1a. Under-18s see a note that a parent will be asked to agree. | 1a, 1c | [png](../screens/sm-1b_sign-up-for-me.png) · [html](../mockups/sm-1b_sign-up-for-me.html) |
| 1c | Verify email | Verify the email with a 6-digit code. | Same as parent 1b. After verifying: under 18 → 1d; 18 or over → 2a. | 2a, 1b | [png](../screens/sm-1c_verify-email.png) · [html](../mockups/sm-1c_verify-email.html) |
| 1d | Under 18: tell us your parent | An under-18 learner gives a parent's name and email. | Practice is not blocked: "Send and continue" emails the parent and carries on to 2a. Explains the parent gets no control, reminders after 3 days, and that declining closes the account. | 2a | [png](../screens/sm-1d_under-18-tell-us-your-parent-practice-starts-straight-away.png) · [html](../mockups/sm-1d_under-18-tell-us-your-parent-practice-starts-straight-away.html) |
| 1e | Under 18: dashboard while consent is pending | The learner's dashboard while the parent hasn't answered yet. | Amber banner at the top: "Waiting for your parent to agree" with Resend and Change email. Everything else works as normal. | 1d, 3c | [png](../screens/sm-1e_under-18-dashboard-while-consent-is-pending.png) · [html](../mockups/sm-1e_under-18-dashboard-while-consent-is-pending.html) |
| 1f | Parent agrees, with an email code | The page the parent opens from the email link. | What owlrnd keeps and never does, a 6-digit code sent to the parent's email (same rules as sign-in), a consent checkbox, an optional read-only progress view (off by default), Decline and I agree. No DigiLocker in 0.2 (roadmap). Decline closes the learner's account and deletes its data. | none | [png](../screens/sm-1f_parent-agrees-with-an-email-code-opened-from-the-email.png) · [html](../mockups/sm-1f_parent-agrees-with-an-email-code-opened-from-the-email.html) |

## 2 · Choose an exam or build your own, and create tracks

| Code | Screen | Purpose | Details | Leads to | Files |
| --- | --- | --- | --- | --- | --- |
| 2a | Choose your exam | Choose an exam package or build your own. | **0.2 (owner, 2026-11-15):** Build your own is its own section at the top (→ 2c); the eight package cards sit in a separate section below, marked Coming soon and not selectable. The mockup shows the later layout with packages first. | 3c, 4.1a, 5b, 3a, 2b, 2c | [png](../screens/sm-2a_choose-your-exam.png) · [html](../mockups/sm-2a_choose-your-exam.html) |
| 2b | Package: JEE Main, choose start points | Set up a package. | Exam session, exam size, one row per track with "Start with" chapter. Create 3 tracks → 3f. | 3c, 4.1a, 5b, 3a, 2a, 3f | [png](../screens/sm-2b_package-jee-main-choose-start-points.png) · [html](../mockups/sm-2b_package-jee-main-choose-start-points.html) |
| 2c | Build your own: no tracks yet | Build your own: no tracks yet. | Empty state explaining tracks. Create the first track → 2d. | 3c, 4.1a, 5b, 3a, 2d | [png](../screens/sm-2c_build-your-own-no-tracks-yet.png) · [html](../mockups/sm-2c_build-your-own-no-tracks-yet.html) |
| 2d | Build your own: start of the chat | Build your own: start of the AI chat. | Greeting, three starter options, message box with Attach file and Take photo, empty Draft preview. | 3c, 4.1a, 5b, 3a, 2c | [png](../screens/sm-2d_build-your-own-start-of-the-chat.png) · [html](../mockups/sm-2d_build-your-own-start-of-the-chat.html) |
| 2e | Build your own: agreed, with a goal | Build your own: track agreed. | Syllabus and notes attached, goal changed. Preview marked Ready. Open your tracks → 4.1a. | 3c, 4.1a, 5b, 3a, 2c | [png](../screens/sm-2e_build-your-own-agreed-with-a-goal.png) · [html](../mockups/sm-2e_build-your-own-agreed-with-a-goal.html) |
| 2f | First track created | First track created. | Confirmation, one track card with no exams yet, goal progress 0 of 3. | 3c, 4.1a, 5b, 3a | [png](../screens/sm-2f_first-track-created.png) · [html](../mockups/sm-2f_first-track-created.html) |
| 2g | Later: a track's exam history | Later: a track's exam history. | Same as parent 2h, with the learner in control. | 3c, 4.1a, 4.3a, 5b, 3a, 2h, 4.1f, 2i | [png](../screens/sm-2g_later-a-track-s-exam-history.png) · [html](../mockups/sm-2g_later-a-track-s-exam-history.html) |
| 2h | Later: a track reaches its goal | Later: a track reaches its goal. | Same as parent 2i, with the learner in control. | 3c, 4.1a, 4.3a, 5b, 3a, 2i, 2g | [png](../screens/sm-2h_later-a-track-reaches-its-goal.png) · [html](../mockups/sm-2h_later-a-track-reaches-its-goal.html) |
| 2i | Add topics to start the track again | Add topics to restart a finished track. | Same as parent 2j, with the learner in control. | 3c, 4.1a, 4.3a, 5b, 3a, 2h | [png](../screens/sm-2i_add-topics-to-start-the-track-again.png) · [html](../mockups/sm-2i_add-topics-to-start-the-track-again.html) |

## 3 · Signing in, then the dashboard

| Code | Screen | Purpose | Details | Leads to | Files |
| --- | --- | --- | --- | --- | --- |
| 3a | Sign in | Sign in. | One sign-in for every account type: "Email or username". Create an account → 1a. | 1a, 3b, 5d | [png](../screens/sm-3a_sign-in.png) · [html](../mockups/sm-3a_sign-in.html) |
| 3b | Sign-in code | Enter the sign-in code. | Code goes to the email that controls the account (own email for self-managed). | 1a, 3a | [png](../screens/sm-3b_sign-in-code.png) · [html](../mockups/sm-3b_sign-in-code.html) |
| 3c | Dashboard: Today | Dashboard: Today. | Same as parent-managed 3c, with JEE tracks. Sidebar has Exams and Tracks. | 4.1a, 4.3a, 5b, 3a, 4.1b, 4.1e | [png](../screens/sm-3c_dashboard-today.png) · [html](../mockups/sm-3c_dashboard-today.html) |
| 3d | Dashboard: Recent exams | Dashboard: Recent exams. | Same as 3d on the parent page. | 3c, 4.1a, 4.3a, 5b, 3a, 4.1b, 4.1e | [png](../screens/sm-3d_dashboard-recent-exams.png) · [html](../mockups/sm-3d_dashboard-recent-exams.html) |
| 3e | Dashboard: All tracks | Dashboard: All tracks. | Same as 3e on the parent page. | 3c, 4.1a, 4.3a, 5b, 3a, 4.1b, 4.1e | [png](../screens/sm-3e_dashboard-all-tracks.png) · [html](../mockups/sm-3e_dashboard-all-tracks.html) |
| 3f | Dashboard: first day | Dashboard: first day. | "Your first track is ready." No parent wording. | 3c, 4.1a, 5b, 3a, 4.1b | [png](../screens/sm-3f_dashboard-first-day.png) · [html](../mockups/sm-3f_dashboard-first-day.html) |
| 3g | Dashboard: nothing to practise | Dashboard: nothing to practise. | "Add new topics to start them again, or create a new track." | 3c, 4.1a, 4.3a, 5b, 3a | [png](../screens/sm-3g_dashboard-nothing-to-practise.png) · [html](../mockups/sm-3g_dashboard-nothing-to-practise.html) |

## 4.1 · Practising an exam

| Code | Screen | Purpose | Details | Leads to | Files |
| --- | --- | --- | --- | --- | --- |
| 4.1a | Your tracks: practise and manage | Your tracks: practise and manage. | The learner both practises and manages here: Add a package, + New track, and per track History, Add material, Pause, Resume, Add topics to continue, Archive. | 3c, 4.3a, 5b, 3a, 2a, 2d, 4.1b, 2g, 2i | [png](../screens/sm-4.1a_your-tracks-practise-and-manage.png) · [html](../mockups/sm-4.1a_your-tracks-practise-and-manage.html) |
| 4.1b | Exam paper | Exam paper. | Unchanged from 0.1. | 3c, 4.1c | [png](../screens/sm-4.1b_exam-paper.png) · [html](../mockups/sm-4.1b_exam-paper.html) |
| 4.1c | Submit with unanswered questions | Submit with unanswered questions. | Unchanged. | 3c, 4.1e, 4.1b, 4.1d | [png](../screens/sm-4.1c_submit-with-unanswered-questions.png) · [html](../mockups/sm-4.1c_submit-with-unanswered-questions.html) |
| 4.1d | Marking in progress | Marking in progress. | Unchanged. | 3c, 4.1e | [png](../screens/sm-4.1d_marking-in-progress.png) · [html](../mockups/sm-4.1d_marking-in-progress.html) |
| 4.1e | Exam result | Exam result. | Unchanged apart from track names. | 3c, 4.1a, 4.3a, 5b, 3a, 4.1f, 4.1g | [png](../screens/sm-4.1e_exam-result.png) · [html](../mockups/sm-4.1e_exam-result.html) |
| 4.1f | Marked paper | Marked paper. | Unchanged. | 4.1e, 3c | [png](../screens/sm-4.1f_marked-paper.png) · [html](../mockups/sm-4.1f_marked-paper.html) |
| 4.1g | Marked written answers | Marked written answers. | Unchanged. | 4.1e, 3c | [png](../screens/sm-4.1g_marked-written-answers.png) · [html](../mockups/sm-4.1g_marked-written-answers.html) |

## 4.2 · Exam formats

| Code | Screen | Purpose | Details | Leads to | Files |
| --- | --- | --- | --- | --- | --- |
| 4.2a | Two-page paper, long questions | Two-page paper, long questions. | Unchanged. | 3c, 4.1e | [png](../screens/sm-4.2a_two-page-paper-long-questions.png) · [html](../mockups/sm-4.2a_two-page-paper-long-questions.html) |
| 4.2b | Mixed paper, page 1: multiple choice | Mixed paper, page 1. | Unchanged. | 3c, 4.1d | [png](../screens/sm-4.2b_mixed-paper-page-1-multiple-choice.png) · [html](../mockups/sm-4.2b_mixed-paper-page-1-multiple-choice.html) |
| 4.2c | Mixed paper, page 2: typed long answers | Mixed paper, page 2: typed long answers. | Unchanged. | 3c, 4.1d | [png](../screens/sm-4.2c_mixed-paper-page-2-typed-long-answers.png) · [html](../mockups/sm-4.2c_mixed-paper-page-2-typed-long-answers.html) |

## 4.3 · Points and levels

| Code | Screen | Purpose | Details | Leads to | Files |
| --- | --- | --- | --- | --- | --- |
| 4.3a | Points page | Points page. | Unchanged. | 3c, 4.1a, 5b, 3a | [png](../screens/sm-4.3a_points-page.png) · [html](../mockups/sm-4.3a_points-page.html) |

## 5 · Profile, sign-out and account help

| Code | Screen | Purpose | Details | Leads to | Files |
| --- | --- | --- | --- | --- | --- |
| 5a | Account menu: Profile or Sign out | Account menu. | Profile or Sign out. Shows name and "JEE Main 2027". | 3c, 4.1a, 4.3a, 5b, 3a, 4.1b, 4.1e | [png](../screens/sm-5a_account-menu-profile-or-sign-out.png) · [html](../mockups/sm-5a_account-menu-profile-or-sign-out.html) |
| 5b | Your profile and account | Profile and account. | Email, password, points. The learner changes their own email and password. | 3c, 4.1a, 4.3a, 3a | [png](../screens/sm-5b_your-profile-and-account.png) · [html](../mockups/sm-5b_your-profile-and-account.html) |
| 5c | Wrong or expired code | Wrong or expired code. | Code sent to the learner's own email. | 1a, 3c, 3a | [png](../screens/sm-5c_wrong-or-expired-code.png) · [html](../mockups/sm-5c_wrong-or-expired-code.html) |
| 5d | Forgot password | Forgot password. | "Email or username"; the reset code goes to the email that controls the account. | 1a, 5e, 3a | [png](../screens/sm-5d_forgot-password.png) · [html](../mockups/sm-5d_forgot-password.html) |
| 5e | Reset password | Reset password. | No "ask your parent" line. | 1a, 3a | [png](../screens/sm-5e_reset-password.png) · [html](../mockups/sm-5e_reset-password.html) |

## Later

| Code | Screen | Purpose | Details | Leads to | Files |
| --- | --- | --- | --- | --- | --- |
| 0.15a | Written answers, uploaded | Later: written answers uploaded. | Not in 0.2. | 3c, 4.1e | [png](../screens/sm-0.15a_written-answers-uploaded.png) · [html](../mockups/sm-0.15a_written-answers-uploaded.html) |
| 0.2a | Camera capture popup | Later: camera capture. | Not in 0.2. | 3c, 4.1e | [png](../screens/sm-0.2a_camera-capture-popup.png) · [html](../mockups/sm-0.2a_camera-capture-popup.html) |
