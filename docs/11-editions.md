# 11 · One site, two kinds of account

**Read this first.** It changes the direction of the product and overrides the parts of this package that assume every learner is a child managed by a parent. Where this document and an older one disagree, this document wins, except for `05-rules.md` details that it doesn't mention.

## 1. What changed

owlrnd now serves two kinds of learner, on **one site, owlrnd.com**:

| | **Self-managed learner** | **Parent-managed learner** |
| --- | --- | --- |
| Who | Higher-education students and competitive-exam aspirants (JEE, NEET, CUET, CAT, GATE, UPSC, SSC, banking) | School children |
| Who is in control | The learner | A parent |
| Who sets up tracks | The learner, from a package or by chatting with the AI | The parent |
| Sign-in code goes to | The learner's own email | The parent's email |
| Designs | Canvas page **MVP · Competitive exams** | Canvas page **MVP** |

Self-managed learners are the main product and the priority. Parent-managed learners use the same app with some controls handed to the parent.

There is no separate school site or subdomain. Everyone signs up and signs in at owlrnd.com.

## 2. How the account type is chosen

### 2.1 Sign-up asks one question: "Who is this account for?"

The first sign-up screen asks this before anything else, with two large choices of equal weight:

- **For me.** "I'm preparing for an exam or studying, and I'll set up my own practice." This creates a **self-managed learner** account.
- **For my child.** "I'm a parent. I'll set up practice for my children." This creates a **parent** account. The parent then adds children (screens 2a–2b on the **MVP** page), and each child gets a **parent-managed learner** account.

Use this question, not an "I am a parent" tick box. A tick box is easy to miss, and a missed tick silently creates the wrong kind of account. A required choice makes both paths visible and puts the right wording on every screen after it.

The rest of sign-up follows the chosen path:

| Step | For me | For my child |
| --- | --- | --- |
| 1 | Your name, email, password, **date of birth** | Your name, email, password |
| 2 | Verify email (6-digit code) | Verify email (6-digit code) |
| 3 | If under 18: a parent gives consent (2.4) | Add a child: name, username, password, **date of birth** |
| 4 | Choose your exam or a package, or build your own track | Set up the child's first track |

### 2.2 One sign-in page for everyone

- There is one sign-in page at owlrnd.com/sign-in, with the field **"Email or username"**. Parents and self-managed learners use their email; parent-managed learners use the username the parent gave them.
- The 6-digit code (rules §1) goes to whoever controls the account: the learner's own email for self-managed learners, and the parent's email for a parent and their children.
- After sign-in, the app opens the right home screen for the role. A parent goes to **Your students**, and a learner (either kind) goes to the **Exams** dashboard.
- The landing page is the **Rank-ready** page for self-managed learners. Nothing in the header or the first screen mentions parents. Lower down, a **For parents** section ("Setting this up for your child?", `#parents`) leads to sign-up with **For my child** already chosen, and the footer links to it. Share owlrnd.com/#parents with parents directly.

### 2.3 Permissions

| Action | Self-managed learner | Parent-managed learner | Parent |
| --- | --- | --- | --- |
| Practise exams, see own results and points | Yes | Yes | No (views only) |
| Create, edit, pause, archive tracks | Yes | No | Yes |
| Add a package | Yes | No | Yes |
| Add topics after a goal is reached | Yes | No | Yes |
| Receive sign-in codes | Own email | Parent's email | Own email |
| Change own password | Yes | No (parent resets it) | Yes |
| See activity and progress | Own | Own | All their children |
| Add or remove children | No | No | Yes |
| Delete the account and data | Yes | No | Yes, for the family |

Implement this as **one permission policy** that every screen and API call checks. The interface hides what a role can't do, and the server refuses it anyway. Don't scatter `if parent` checks through the code.

### 2.4 Learners under 18 who choose "For me"

**Owner's decisions:** an under-18 learner can start practising straight away. The parent's consent is collected in parallel, and in 0.2 the parent is verified by **email code only**.

How it works:
- Sign-up asks for **date of birth** on both paths.
- After verifying their email, an under-18 learner gives a parent's name and email (screen 1d), then carries straight on to choosing an exam.
- owlrnd emails the parent a link to the consent page (1f). The page also sends a **6-digit code** to the same email; the parent enters it to prove they control that address. This uses the same code rules as sign-in (10 minutes, single use, 3 tries).
- On 1f the parent sees what owlrnd keeps and never does, ticks the consent box, can turn on an optional read-only progress view (off by default), and taps **I agree** or **Decline**. The parent gets **no control** over tracks.
- While consent is pending, the learner's dashboard shows a banner with Resend and Change email (1e). Practice is not blocked.
- Reminders go to the parent after 3 days. The link is valid for 7 days, and a new one can be sent.
- **If the parent declines**, the account is closed and its data deleted. Working default for no answer after 30 days: pause practice and ask the learner to resend.
- The learner stays self-managed. They still set up their own tracks and receive their own sign-in codes.
- Block obvious self-consent: the parent's email can't be the learner's own email or the email of another learner account.

**Verification levels.** Store a `verification_level` on each consent record so stronger checks can be added later without changing the flow:

| Level | How | When |
| --- | --- | --- |
| `email_code` | The parent entered the 6-digit code sent to their email | 0.2 (now) |
| `manual` | A staff member checked the parent from the back office | Roadmap item 13, if the product picks up |
| `digilocker` | The parent verified through DigiLocker or a similar service | Roadmap item 14 |

Keep consent requests, codes sent, answers, levels and timestamps as an audit record.

India's Digital Personal Data Protection Rules (notified 14 November 2025, coming into force in phases) ask for verifiable parental consent *before* a child's data is processed, and describe identity checks for the parent. Practising before consent, and email-only verification, are the owner's business decisions. Build the consent step behind a setting that can switch to "block until consent" without code changes, and flag both decisions for legal review before launch.

### 2.5 Moving from parent-managed to self-managed

*0.2 (owner, 2026-11-16): not in 0.2; parked on the roadmap (`09-roadmap.md` item 18). A parent-created account stays the parent's.*

A parent-managed learner can become self-managed, for example at 18 or when the parent releases them. Their history, tracks and points stay. They add their own email, and from then on they receive their own codes and control their own tracks. The parent loses control, and their view of that child ends unless the learner keeps it on.

### 2.6 Packages

> **Owner, 2026-11-15:** packages are **not in 0.2**. Only Build your own works; the package cards show as Coming soon (screen 2a), and 2b is not built. Track rules stay as in 0.1. See `plan-0.2.md` and roadmap item 15.

There is one package catalogue, with each package tagged by audience:
- **self-managed:** JEE Main, NEET UG, CUET UG, CAT, GATE, UPSC Prelims, SSC CGL, Bank PO, and "Build your own".
- **parent-managed:** school boards and classes (for example CBSE and ICSE), when they are ready.

The app shows each person the packages for their account type. A package is just a template that creates normal tracks; the track engine doesn't know or care where a track came from.

### 2.7 Shared family computers

Parents and children often share one computer. So:
- The account menu always shows who is signed in (name and role), as in the designs.
- After signing out, the sign-in page doesn't pre-fill the last user.
- Sessions time out after a period of inactivity. Working default: 7 days for self-managed learners and parents, 12 hours for parent-managed learners. *0.2 (owner, 2026-11-16): 30 days for everyone, as in 0.1.*

## 3. Data model changes

These are additions to `06-data.md`:

- **Account:** add `type` (`self_managed` | `parent` | `parent_managed`), `date_of_birth` (learners) and `email` (required for self-managed and parent; optional for parent-managed, which use `username`).
- **Family:** a parent and their parent-managed children. Plan for more than one parent per family later.
- **Parent link:** parent ↔ learner, with `kind` (`manages` for parent-managed, `consents` for an under-18 self-managed learner), consent status, a verification record and the date given.
- **Track:** add `owner` (the learner for self-managed, the family for parent-managed) and `source_package` (optional).
- **Package:** add `audience` (`self_managed` | `parent_managed`) and the list of track templates it creates.

## 4. Build order

1. **Shared core:** accounts with the three types, the permission policy, tracks, exams, marking, results and points. Build all three account types in the data model from day one, even though only one path ships first.
2. **The "For me" path first:** the self-managed screens (canvas page **MVP · Competitive exams**: 1a–5e), packages, and the under-18 consent step. Add the "Who is this account for?" question as the first step of sign-up.
3. **The "For my child" path:** the parent screens already designed (canvas page **MVP**: 1a–5h), reached from the same question.
4. **Moving from parent-managed to self-managed** (2.5), once both paths are live.

## 5. What this changes in the older documents

- `01-product.md` and `CLAUDE.md` describe the parent path only. Read them as "the For my child path".
- **"The parent controls everything"** applies to parent-managed learners only. Self-managed learners control everything themselves.
- **"Every sign-in sends a code to the parent's email"** becomes "to the email of whoever controls the account" (table in 2.3).
- **"Students and parents sign in here"** stays true, with one sign-in page for every account type.
- **"Packages: Coming soon"** applies to the parent path. For self-managed learners, packages are part of the first release.

## 6. Open questions for the owner

| Question | Working default |
| --- | --- |
| Can a parent-managed learner choose to see their own sign-in codes? | No |
| Does a consenting parent of an under-18 self-managed learner see progress? | Optional read-only view, off by default |
| Can one person be a parent and a self-managed learner with one email? | No, one email per account; a second account needs a second email |
| Can a self-managed account later add children? | No; a parent account is a separate account |
| Is pricing different per account type? | Not decided; keep plans tied to the account |
