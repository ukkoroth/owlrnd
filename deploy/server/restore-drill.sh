#!/usr/bin/env bash
# Backup restore drill (release plan, Phase 1 item 10). Read-only: prints row counts per table for production and a
# restored copy, using the live image and its .env (user, TLS settings), with the restored host and password swapped
# in. No rows, no secrets.
#
# 1. From your laptop, restore the latest backup into a scratch database:
#      aws lightsail create-relational-database-from-snapshot --relational-database-name owlrnd-db-restore-drill \
#        --source-relational-database-name owlrnd-db --use-latest-restorable-time --relational-database-bundle-id micro_2_0 \
#        --no-publicly-accessible --tags key=Project,value=owlrnd key=Purpose,value=restore-drill
# 2. When it's available, run this on the server. A restored database gets a NEW master password (not the live one's):
#      PW=$(aws lightsail get-relational-database-master-user-password --relational-database-name owlrnd-db-restore-drill \
#        --query masterUserPassword --output text)
#      { printf 'export RESTORED_PW=%q\n' "$PW"; cat deploy/server/restore-drill.sh; } | ssh <server> 'sudo bash -s <restored-host>'
# 3. Delete the scratch database: aws lightsail delete-relational-database --relational-database-name owlrnd-db-restore-drill --skip-final-snapshot
set -euo pipefail
cd /opt/owlrnd
RESTORED_HOST="${1:?restored database host}"
TAG="$(cat current-tag)"
docker run --rm -i --env-file .env -e RESTORED_HOST="$RESTORED_HOST" -e RESTORED_PW -w /app "owlrnd:$TAG" node - <<'JS'
const { Client } = require("pg");
const tables = ["parents", "students", "parent_links", "sessions", "codes", "tracks", "topics", "track_messages",
  "attachments", "exams", "questions", "exam_questions", "answers", "marks", "topic_results", "points_events",
  "flashcards", "flashcard_sessions", "flashcard_reviews", "consent_requests", "consent_events", "invitations",
  "access_requests", "ai_usage", "jobs"];
const restoredUrl = () => { const u = new URL(process.env.DATABASE_URL); u.hostname = process.env.RESTORED_HOST; if (process.env.RESTORED_PW) u.password = encodeURIComponent(process.env.RESTORED_PW); return u.toString(); };
async function survey(url) {
  const c = new Client({ connectionString: url, connectionTimeoutMillis: 15000 });
  await c.connect();
  try {
    const out = {};
    for (const t of tables) out[t] = (await c.query(`select count(*)::int as n from "${t}"`)).rows[0].n;
    const m = await c.query("select count(*)::int as n, max(created_at)::text as last from drizzle.__drizzle_migrations");
    const latest = await c.query("select max(created_at)::text as t from sessions");
    return { out, migrations: m.rows[0], latestSession: latest.rows[0].t };
  } finally { await c.end(); }
}
(async () => {
  const prod = await survey(process.env.DATABASE_URL);
  const rest = await survey(restoredUrl());
  console.log("table".padEnd(20), "prod".padStart(8), "restored".padStart(9));
  for (const t of tables) console.log(t.padEnd(20), String(prod.out[t]).padStart(8), String(rest.out[t]).padStart(9), prod.out[t] === rest.out[t] ? "" : "  (differs)");
  console.log("migrations          ", prod.migrations.n, "vs", rest.migrations.n);
  console.log("newest session       prod", prod.latestSession, "| restored", rest.latestSession);
})().catch((e) => { console.error("DRILL FAILED:", e.message); process.exit(1); });
JS
