#!/usr/bin/env bash
# Switches /opt/owlrnd to an image that is already loaded (docker load), after running its migrations.
# Usage: deploy.sh <tag>. If the new version isn't healthy, goes back to the previous one.
set -euo pipefail
cd /opt/owlrnd
TAG="${1:?usage: deploy.sh <tag>}"
docker image inspect "owlrnd:$TAG" >/dev/null

echo "== migrations"
docker run --rm --env-file .env "owlrnd:$TAG" node migrate.cjs

PREV="$(cat current-tag 2>/dev/null || true)"
echo "== starting $TAG (previous: ${PREV:-none})"
echo "OWLRND_TAG=$TAG" > tag.env
if docker compose --env-file tag.env up -d --wait --wait-timeout 120; then
  [ -n "$PREV" ] && [ "$PREV" != "$TAG" ] && echo "$PREV" > previous-tag
  echo "$TAG" > current-tag
  # Keep the three newest owlrnd images for rollback; remove older ones.
  docker images owlrnd --format '{{.CreatedAt}}\t{{.Tag}}' | sort -r | tail -n +4 | cut -f2 | xargs -r -I{} docker rmi "owlrnd:{}" >/dev/null || true
  echo "== deployed $TAG"
else
  echo "== $TAG did not become healthy" >&2
  docker compose --env-file tag.env logs --tail 80 app >&2 || true
  if [ -n "$PREV" ]; then
    echo "OWLRND_TAG=$PREV" > tag.env
    docker compose --env-file tag.env up -d --wait --wait-timeout 120
    echo "== rolled back to $PREV" >&2
  else
    # Nothing to go back to: stop the broken container (Caddy shows the holding page).
    docker compose --env-file tag.env down
  fi
  exit 1
fi
