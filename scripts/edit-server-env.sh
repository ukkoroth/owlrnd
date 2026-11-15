#!/usr/bin/env bash
# npm run server:env: edit the live server's settings (/opt/owlrnd/.env) in TextEdit on this Mac.
# Downloads a private temporary copy, opens it, and when you quit TextEdit uploads it back if it changed.
# The previous version stays on the server as .env.bak. The local copy is always deleted.
# After saving, restart the app (or deploy) for changes to take effect.
set -euo pipefail
KEY="${OWLRND_SSH_KEY:-$HOME/.ssh/owlrnd-lightsail.pem}"
HOST="ubuntu@${OWLRND_HOST:-owlrnd.com}"
DIR="$(mktemp -d)"; chmod 700 "$DIR"
trap 'rm -rf "$DIR"' EXIT
FILE="$DIR/owlrnd-server-settings.txt"

scp -q -i "$KEY" "$HOST:/opt/owlrnd/.env" "$FILE"
chmod 600 "$FILE"; cp "$FILE" "$DIR/original"
echo "Opened in TextEdit. Edit, save (Cmd+S), then quit TextEdit (Cmd+Q) to upload."
open -W -e "$FILE"

if cmp -s "$FILE" "$DIR/original"; then echo "No changes; nothing uploaded."; exit 0; fi
# Every line must be blank, a comment, or NAME=value.
if bad="$(grep -n -v -E '^\s*$|^\s*#|^[A-Z][A-Z0-9_]*=' "$FILE")"; then
  echo "Not uploaded: these lines aren't NAME=value:"; echo "$bad" | cut -d: -f1 | sed 's/^/  line /'; exit 1
fi
scp -q -i "$KEY" "$FILE" "$HOST:/opt/owlrnd/.env.new"
ssh -i "$KEY" "$HOST" 'cd /opt/owlrnd && chmod 600 .env.new && cp -p .env .env.bak && mv .env.new .env'
echo "Saved to the server (previous version kept as /opt/owlrnd/.env.bak)."
