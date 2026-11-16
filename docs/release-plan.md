# owlrnd 0.1 release plan: closed beta

Written 2026-11-14, after M6 (all of 0.1 built). This plan takes owlrnd from a laptop to a closed beta with a handful of invited families.

## Decisions

| Topic | Decision | By |
|---|---|---|
| Audience | **Closed beta:** your family plus about 10 invited families; sign-up by invitation only | Owner |
| Hosting | **AWS Lightsail:** one 2 GB Linux server (app + background worker), Lightsail managed PostgreSQL, S3 for photos | Owner |
| Region | **Mumbai (ap-south-1)**, closest to families in India *(working default; change if families are elsewhere)* | Default |
| Email | **Amazon SES** over SMTP (no code change; owlrnd already speaks SMTP). Postmark stays possible later | Owner |
| Domain | **To buy.** Suggested: through Route 53, so DNS for the app and SES lives in the same AWS account | Owner |
| Serverless | **Not for the beta.** The background worker needs an always-on server. Moving it to a queue is a later option if traffic grows | Owner (2026-11-14) |
| Beta length | **4 weeks**, then a review before any public launch *(working default)* | Default |

## Estimated monthly cost (beta)

Approximate list prices; check the AWS pricing calculator for Mumbai.

| Item | Cost |
|---|---|
| Lightsail server, 2 GB | ~$12 |
| Lightsail managed PostgreSQL (with daily backups) | ~$15 |
| S3 (photos and weekly database copies) | < $1 |
| SES (sign-in codes) | cents |
| Domain + DNS | ~$1.50 (domain ~$15/year) |
| **Infrastructure** | **≈ $30** |
| Claude Opus 5.5 (`claude-opus-5-5`): about $0.13–0.27 per exam (with its flashcards), $0.04–0.16 per chat turn, ~$0.20 per starter deck; practising flashcards is free (measured 2026-11-16, README "Running costs") | ≈ $75–145 for 10 students doing 1–2 exams a day |
| **Total** | **≈ $100–170** |

Claude is the main cost. Phase 1 measures the real cost per exam and adds a hard monthly limit.

## Phase 1 · Make the code production-ready (Claude builds; about 1 week)

1. **Invitations (closed beta).** *Done 2026-11-15, with a waiting list:* the landing page's "Get access" buttons lead to `/get-access`, which records requests in `access_requests` (and emails `OWNER_EMAIL` if set); `npm run access -- list [--pending]` shows them and `npm run invite -- --pending` invites everyone waiting. Switch off with `rules.access.inviteOnly`. Sign-up needs an invitation. An `invitations` table holds the email, a token and an expiry; `npm run invite -- parent@example.com` emails a sign-up link through the existing email adapter. Without a valid invitation, sign-up (1a) says the beta is invite-only. Students are still added by their parent.
2. **Photos on S3.** *Done 2026-11-15: `S3FileStore` (FILE_STORE=s3, S3_BUCKET), objects encrypted with SSE-S3; `npm run s3:check` verifies a bucket end to end.* An `S3FileStore` behind the existing `FileStore` interface (`src/server/files/index.ts`), private bucket, server-side encryption. Local disk stays for development.
3. **Clean-up of uploaded files.** *Done 2026-11-15: deleting an account, removing a student, Start over and discarding an update chat queue a `delete_files` job (8 attempts) in the same transaction as the delete.* Deleting a parent, a student or a track draft also deletes their photos from storage (today only the database rows go). Gap noted in the roadmap discussion.
4. **AI cost controls.** *Done 2026-11-15: every Claude call is recorded in `ai_usage` with its estimated cost (`src/config/aiPrices.ts`); per family per day, 40 chat messages and 20 exams written (`rules.aiLimits`; over the exam limit the writing waits until the family's next midnight); monthly budget `AI_MONTHLY_BUDGET_USD` (default $150) with owner emails at 80% and 100%, pausing new chats and exams at 100% while marking continues; `npm run ai:usage` shows the month's spend. Still to do by the owner: a spend limit on the API key in the Claude Console (Phase 2).*
   - **Recording usage:** every Claude call records its tokens (`ai_usage`: purpose, model, input/output/cache tokens, estimated cost, family).
   - **Limits per family per day** (configurable in `src/config/rules.ts`): for example 40 chat turns and 10 exams written. Over the limit, a friendly "come back tomorrow" message.
   - **Monthly budget:** a cap (for example $150). Near it, the owner gets an email. At it, new chats and exams pause with a clear message, while marking of already-submitted exams still finishes.
   - **Spend limit:** also set a hard spend limit on the API key in the Claude Console (Phase 2).
5. **Production hardening.** *Done 2026-11-15: Caddy serves HTTPS with HSTS (`deploy/Caddyfile`); per-request nonce Content-Security-Policy and fixed security headers in the app; client IP from the last X-Forwarded-For entry; per-IP limits on sign-in, code entry, code sends, sign-up, password reset and Get access (`rules.rateLimits`); settings checked at start-up, with production-only checks under `DEPLOY_ENV=production`; background jobs run in parallel (`JOB_CONCURRENCY`, default 6).*
   - **HTTPS and headers:** HTTPS only, with security headers (HSTS, a Content-Security-Policy that allows only the app itself, frame-ancestors none).
   - **Requests:** the client IP is read correctly behind the proxy; per-IP rate limits on sign-in, code and sign-up requests.
   - **Configuration:** checked at start-up, so a missing setting stops the server with a clear error instead of failing later.
6. **Monitoring.**
   - **Errors:** an error tracker (Sentry free tier) for server and browser errors.
   - **Logs:** structured logs on the server.
   - **Daily summary email to the owner:** new sign-ups, exams taken, failed jobs, Claude spend.
   - **Alerts:** an email when a job fails for good or the health check fails.
7. **Privacy and consent** (not legal advice; worth a review by someone who knows India's DPDP Act):
   - **Policy pages:** *Done 2026-11-15 (`/privacy`, `/terms`, `/contact`; operator Unni Koroth, contact hello@owlrnd.com, Indian law, courts of Kerala). Not yet reviewed by a lawyer.* A short privacy policy and terms page, covering what is stored, that photos and answers are sent to Anthropic's API to write and mark exams (API data isn't used to train models by default), how to delete everything, and contact details.
   - **Consent at sign-up:** *Done 2026-11-15: required checkbox, checked on the server, recorded on the parent (`consented_at`, `consent_version` from `src/config/legal.ts`).* a checkbox where the parent confirms they are the child's parent or guardian and consent to processing their child's data.
   - **Deletion:** "Delete my account" already deletes everything; after item 3 it includes the photos.
8. **Security and accessibility checks.**
   - **Security review:** a full security review of the code (`/security-review`), plus `npm audit` with high and critical issues fixed.
   - **Accessibility:** automated accessibility checks (axe) on every main screen in the browser tests, and a keyboard-only pass.
9. **Deployment pipeline.** *Done 2026-11-15, without ECR: GitHub Actions builds the image and copies it to the server over SSH (`.github/workflows/ci.yml`, `deploy/`); deploys run while the repository variable `DEPLOY_ENABLED` is `true`; `npm run deploy` and `npm run rollback`.*
   - **Docker:** a Dockerfile (Next.js standalone build) and Docker Compose on the server, with Caddy in front for automatic HTTPS (Let's Encrypt).
   - **Deploy:** GitHub Actions runs the tests, builds the image, pushes it to Amazon ECR, then over SSH runs the database migrations and restarts the app.
   - **One-command deploy and rollback:** `npm run deploy` and `npm run rollback`, which goes back to the previous image.
10. **Backups.**
    - **Daily:** Lightsail daily database backups (kept 7 days).
    - **Weekly:** a `pg_dump` to S3, kept 8 weeks.
    - **Restore drill:** restore a backup into a scratch database and check that it opens.

**Done when:** all tests pass, including the new ones for invitations, S3, limits and file clean-up; the security review shows no high issues; the app runs from the Docker image locally.

## Phase 2 · Set up AWS and the domain (you, with step-by-step notes from Claude; about 1–2 hours plus waiting)

*Started 2026-11-15: Claude created the DNS zone, server, database, bucket, IAM user and SES identity. Domain is `owlrnd.com`, bought at Hostinger rather than Route 53, and the site is served at the apex. The inventory lives in `private/infra.md` (git-ignored, owner's machine only).*

1. **Domain:** buy it (Route 53 → Registered domains).
2. **Server:**
   - create a Lightsail instance: Ubuntu, 2 GB, Mumbai; attach a static IP;
   - open ports 80 and 443 only;
   - SSH by key only.
3. **Database:** Lightsail managed PostgreSQL in the same region, not publicly accessible, with automatic backups on.
4. **Storage:** an S3 bucket for photos (private, encrypted), and an IAM user with access to that bucket only.
5. **Email (SES):**
   - verify the domain with DKIM records (one click with Route 53);
   - set a custom MAIL FROM;
   - **request production access** (leaving the SES sandbox takes about a day);
   - create SMTP credentials.
6. **DNS:** `app.<domain>` → the static IP; SPF, DKIM and DMARC records for email.
7. **Claude:** a production API key with a monthly spend limit in the Claude Console.
8. **Budget alert:** AWS Budgets alert at $50/month for infrastructure.
9. **Secrets:** all secrets go into the server's environment file and are never committed. Claude prepares the template and a checklist.

## Phase 3 · First deploy and checks (together; about half a day)

1. **Deploy** to `app.<domain>`; migrations run; the health check is green.
2. **Live checks:**
   - `npm run ai:smoke` against production settings;
   - the full browser test suite pointed at the live site, using a test family that is deleted afterwards.
3. **Real devices:**
   - sign up with a real email, add a child, create a track from real textbook photos on a phone, and take and mark an exam;
   - check the codes arrive (Gmail, Outlook, a school or work address) and don't land in spam.
4. **Failure checks:**
   - restart the server mid-marking: the job resumes;
   - restore a backup into a scratch database.
5. **Your review:** confirm or adjust the working defaults in `docs/10-decisions.md` (goal, mix, points, levels, limits).

## Phase 4 · Beta (4 weeks)

- **Invitations:** invite families a few at a time (3, then about 10), with a one-page "how owlrnd works" note for parents.
- **Feedback:** a feedback link in the app (a mailto or short form) and a weekly check-in with beta parents.
- **Watch daily:** the summary email (errors, failed jobs, spend).
- **Watch weekly:** cost per exam, question quality complaints, marking disputes, and email deliverability.
- **Fixes:** fixes ship the same way (tests → deploy), with rollback ready.

## Phase 5 · After the beta

- Decide on a public launch, and what it needs: open sign-up, abuse limits, support, a fuller legal review, perhaps payments.
- Pick up the roadmap's "Soon after the initial release" items, then version 0.15.
- Revisit hosting if usage grows (move the worker to a queue so the app can run serverless; separate database sizing).

## Order and timing

Phase 1 (about 1 week of building) and Phase 2 (yours, can start now: buy the domain and request SES production access early, because that approval takes about a day) run in parallel. Then Phase 3 (half a day), then Phase 4.
