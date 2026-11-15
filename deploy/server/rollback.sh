#!/usr/bin/env bash
# Goes back to the previously deployed image. Database migrations are not undone (they only add to the schema).
set -euo pipefail
cd /opt/owlrnd
PREV="$(cat previous-tag 2>/dev/null || true)"
CUR="$(cat current-tag 2>/dev/null || true)"
[ -n "$PREV" ] || { echo "No previous version to roll back to." >&2; exit 1; }
echo "== rolling back from ${CUR:-?} to $PREV"
echo "OWLRND_TAG=$PREV" > tag.env
docker compose --env-file tag.env up -d --wait --wait-timeout 120
echo "$CUR" > previous-tag
echo "$PREV" > current-tag
echo "== now running $PREV"
