# 9. Roadmap (after 0.1)

Do not build these in 0.1. Keep the design open to them where noted.

## Soon after the initial release

Small gaps found while building 0.1 (added 2026-11-14). Pick these up first after 0.1 is live.

- **In-page camera for "Take photo" in the track chat (2e, 2f, 2j).** Today the button opens the device's file picker (`capture` attribute), which on a laptop doesn't show the camera. Add a camera view inside the chat, like the 0.2a popup, for photographing textbook pages. This can share its camera component with version 0.2.
- **Ask for the current password when a parent changes their email (5d).** Today the change needs only a code sent to the new address, as rules §1 say. Also asking for the current password would stop someone using a signed-in device left open from moving the account, and all sign-in codes, to their own email.
- **Exams open in full screen (4.1b, 4.2a–4.2c).** *(Added 2026-11-15, owner.)* Pressing Start puts the exam paper in full screen by default, so the paper has the whole screen and the rest of the browser is out of sight, like sitting a real paper. The exam's top bar has a button to exit full screen and, once out, a button to go back into it; leaving with Esc works too. Notes for building it:
  - Browsers only allow full screen from a click, so the Start button (or Continue) must request it. If the browser refuses or doesn't support it (iPhone Safari, for example), the exam opens normally with no error.
  - Entering or leaving full screen changes the window size, so the pages are laid out again (rules §5); answers and the current question are kept, as on any resize.
  - Leaving full screen never leaves the exam, and "Leave exam" also exits full screen.
- **A question taller than the whole page.** The paper never scrolls (rules §5), but a single question taller than a full column can't be split or shrunk, so it overflows. This is very rare with questions of a word or one sentence. Fix it by asking the AI to keep prompts short (with a length check when questions are written), or by letting just that one question scroll inside its own box.

## Later versions

1. **Version 0.15: upload written answers.** The student writes longer answers on paper and uploads photos or a PDF with the exam (screen 0.15a). *Plan for it:* answers can carry attachments; marking can be asynchronous.
2. **Version 0.2: camera capture.** The student photographs each answer page with the laptop camera, one page at a time, without leaving the exam (screen 0.2a).
3. **Ready-made packages.** Board and class packages (CBSE, ICSE) and add-on packs (general knowledge, coaching, AI) that load tracks automatically. Shown as Coming soon in 0.1 (2c).
4. **Create a track from Claude.** A connector so a parent talking to Claude about their child's studies can ask Claude to create an owlrnd track from that conversation. The parent confirms in owlrnd before it goes live. *Plan for it:* keep track creation as one internal operation that both the chat and an external caller can use.
5. **Several tracks at once.** From one chat or one connector request, propose one track per chapter or test from a term's syllabus or test timetable; the parent confirms them together.
6. **Flashcards.** Missed questions and weak topics as flashcards between exams, grouped by track.
7. **Progress views.** A student progress page and a fuller parent profile with scores over time.
8. **owlrnd for college students.** A separate version with no parent account: students sign up, verify their own email, receive their own codes and set up their own tracks.
9. **A shared, self-improving question bank.** *(Added 2026-11-15, owner.)* Today every question is written for one track and used only there. Instead, keep every good question in one shared bank and reuse it for any student studying the same thing, writing new questions with the AI only when the bank has nothing suitable. This cuts the AI cost per exam (writing papers is most of the bill), makes papers appear instantly, and lets question quality improve with use.
   - **Describe each question richly.** Board and class, subject, a shared topic taxonomy (so "Ohm's law" in two families' tracks is the same topic), question type, the skill it tests (recall, apply, multi-step), the source it was written from (textbook, edition, chapter, when known), and a fingerprint of its wording to catch near-duplicates.
   - **Grade questions from real answers.** Every marked answer updates the question's statistics: how hard it really is (share answered correctly, adjusted for the strength of the students who met it, in the style of item response theory), how well it separates strong from weak students, and how often it is left blank. A question that strong students keep getting wrong is a sign of a bad answer key.
   - **Check quality before and after use.** New questions pass an AI review (one correct answer, plausible wrong options, suitable for the class) before entering the bank. Flags from parents or students, suspicious statistics, or a failed review take a question out of circulation for a person or the AI to look at.
   - **Choose questions to fit the child.** The exam plan (rules §4: weak topics, strong topics, retries) stays the same, but each slot is filled from the bank: the right topic and class, a difficulty matched to the child's current level on that topic, never a question they have seen recently, and a mix of question styles. Only gaps are written fresh, and those join the bank.
   - **Fit with ready-made packages (item 3).** A CBSE or ICSE package is a curated, pre-graded slice of the same bank.
   - **Privacy and rights to settle first.** Questions written from one family's uploaded pages would reach other families, so: the bank holds only questions, never the material or anything about the child; no names or personal details in questions (checked when they are written); decide what happens to shared questions when a family deletes their account; update the privacy policy and ask parents to agree; and check that reusing questions derived from copyrighted textbooks is allowed.
   - *Plan for it now:* keep writing topic names and question types consistently, store question statistics per question (not only per exam), and keep the AI-written explanation with each question.
