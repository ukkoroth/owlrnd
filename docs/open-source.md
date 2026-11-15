# Going open source

owlrnd is licensed **AGPL-3.0-or-later** (`LICENSE`, decided 2026-11-15; copyright Unni Koroth). The GitHub repository stays **private** until the checklist below is done.

## Before making the repository public

1. ~~**Real names out of the files.**~~ *Done 2026-11-15:* mockups, screenshots, `CLAUDE.md` and the flow and screen docs now come from the updated hand-off, which uses sample names (Atticus Finch, Scout, Jem). The only real name left is the operator and copyright holder, on purpose.
2. **Real names out of the history.** Old commits keep the old files. Either rewrite the history (`git filter-repo`) or publish a fresh repository that starts from one clean commit. A fresh start is simpler and loses only the commit log.
3. ~~**Infrastructure details.**~~ *Done:* moved to `private/infra.md`, which is git-ignored.
4. **Commit author email.** Commits use a personal work address. To hide it, rewrite authors to the GitHub `noreply` address during step 2, and set `user.email` to it for future commits.
5. **Secret scan.** Run a scanner over the full history (for example `gitleaks detect`) even though earlier checks found only `.env.example`.
6. ~~**Source link (AGPL section 13).**~~ *Done.* Set `site.sourceUrl` in `src/config/site.ts` to the public repository URL; the site footer then shows "Source code" to every visitor.
7. **Project files.** Add `SECURITY.md` (how to report a vulnerability: hello@owlrnd.com) and, if you want contributions, `CONTRIBUTING.md`.
8. **Name and logo (optional).** The AGPL covers the code, not the owlrnd name or logo. If you want forks to use a different name, say so in the README.
9. **Make it public:** `gh repo edit ukkoroth/owlrnd --visibility public --accept-visibility-change-consequences`.

## Already done

- `LICENSE` holds the unmodified AGPL-3.0 text from gnu.org.
- `package.json` declares `"license": "AGPL-3.0-or-later"`; the README has a licence section.
- Production dependencies checked: MIT, Apache-2.0, ISC, BSD, 0BSD, Unlicense, MIT-0, CC-BY-4.0 (data) and LGPL-3.0-or-later (`libvips` in `sharp`) are all compatible with AGPL-3.0.
- The terms of use separate the hosted service from the software licence.
