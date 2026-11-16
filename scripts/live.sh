#!/usr/bin/env bash
# Runs the access/invite tool inside the live app on owlrnd.com.
#   npm run live:access -- list [--pending]
#   npm run live:invite -- someone@example.com [...]
#   npm run live:access -- allowance someone@example.com [<usd> | default]
# Uses your admin SSH key (OWLRND_SSH_KEY, default ~/.ssh/owlrnd-lightsail.pem).
set -euo pipefail
args=$(printf '%q ' "$@")
ssh -i "${OWLRND_SSH_KEY:-$HOME/.ssh/owlrnd-lightsail.pem}" "ubuntu@${OWLRND_HOST:-owlrnd.com}" \
  "cd /opt/owlrnd && docker compose --env-file tag.env exec -T app node access.mjs $args"
