# owlrnd: instructions for Claude Code

You are building **owlrnd version 0.1**, a web app where a parent sets up practice tracks for their children and each child practises short, paper-style exams that adapt to their results.

This package is the complete brief. Read it before writing code.

## Read in this order

1. `docs/01-product.md`: what owlrnd is, who it is for, and the principles behind it.
2. `docs/02-scope-0.1.md`: exactly what is in and out of version 0.1.
3. `docs/03-flows.md`: the user journeys, step by step, with screen codes.
4. `docs/04-screens.md`: every screen, what it does, and where each action leads. Each row links to a screenshot in `screens/` and a static HTML snapshot in `mockups/`.
5. `docs/05-rules.md`: the business rules (sign-in codes, tracks, goals, exam building, paging, marking, suggestions, points). **These are the source of truth.**
6. `docs/06-data.md`: the things the app stores and how they relate.
7. `docs/07-ai.md`: what the AI does, its inputs and outputs, and its limits.
8. `docs/08-design.md`: colours, type, spacing and components.
9. `docs/09-roadmap.md`: what comes after 0.1. **Do not build these.**
10. `docs/10-decisions.md`: open questions, with the working default to use until the owner decides.

## Source of truth

When documents disagree, follow this order:

1. `docs/05-rules.md`
2. `docs/04-screens.md` and `docs/03-flows.md`
3. The screenshots in `screens/`
4. The HTML snapshots in `mockups/`

The HTML snapshots are reference only: use them for exact wording, layout and colours. They use inline styles and sample data; do not copy them as production code.

## Scope fence

- Build only what `docs/02-scope-0.1.md` lists as in scope.
- Screens whose code starts with `0.15` or `0.2` are later versions, included only so you can plan for them. Do not build them.
- Screens titled "Later: …" (2h, 2i) are 0.1 screens shown at a later moment in time, with more data. Build them.
- Names in the mockups (Atticus Finch, Scout, Jem), scores, dates and track names are sample data.

## Things that are not decided in this package

- **The technology stack.** Confirm it with the product owner before you start. Do not pick one yourself.
- Pricing and payments. 0.1 has none.
- Anything listed in `docs/10-decisions.md` that the owner later answers. Until then, use the default written there and keep it easy to change.

## Non-negotiables

- **Every sign-in needs a 6-digit code sent to the parent's email**, for parents and students alike (rules §1).
- **An exam page never scrolls.** It fits the browser window; extra questions go to the next page (rules §5).
- **Adaptivity happens between exams, never inside one.** The whole paper is shown at once (rules §4).
- **Tracks stop at their goal** and only restart when the parent adds topics (rules §3).
- **The parent controls everything; the student can only practise and view their own results.**
- **The AI stays inside the track's topics and the material the parent provided** (AI §6).
- Accessible controls: real buttons, links and labelled inputs; touch targets at least 44px; text contrast at least 4.5:1.

## Suggested build order

Work in milestones. Finish and test each before starting the next.

| Milestone | Builds | Done when |
|---|---|---|
| M1 · Accounts | Parent sign-up and email verification (1a, 1b), sign-in with code for both roles (3a, 3b, 5f), forgot and reset password (5g, 5h), profile menu and sign-out (5a–5d) | A parent can sign up, verify, sign out and sign back in with a code; wrong and expired codes behave as in rules §1 |
| M2 · Students | Add a student, confirmation, students page, edit or remove (2a, 2b, 2k, 5e) | A parent can add two students; each can sign in with their own username and the parent's code |
| M3 · Tracks with AI | Set-up choice, empty tracks, AI chat to create a track with a goal, tracks page (2c–2g) | A parent creates a track from a description and photos; the AI proposes topics and a goal; the parent confirms |
| M4 · Exams | Student dashboard (3c–3g), your tracks (4.1a), exam paper with paging (4.1b, 4.2a–4.2c), submit warning (4.1c) | A student starts a suggested exam, answers on one or two pages and submits |
| M5 · Marking and results | Marking in progress (4.1d), result (4.1e), marked paper (4.1f), marked written answers (4.1g), next-exam adaptation | Results match the marking rules; the next exam in the track shifts towards weak topics |
| M6 · Goals, history, points | Exam history (2h), goal reached (2i), add topics (2j), points page (4.3a), activity charts (3c, 2k) | A track stops at its goal and restarts after topics are added; points match the formula in rules §8 |

## Working style

- Ask the owner when a rule is missing or unclear rather than inventing product behaviour.
- Keep the rules configurable where `docs/10-decisions.md` marks them as defaults (goal threshold, strong-topic rule, points values, level thresholds, code expiry).
- Write tests for the rules in `docs/05-rules.md`, especially sign-in codes, paging, goals and points.
