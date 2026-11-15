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
