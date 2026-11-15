#!/usr/bin/env bash
# npm run rollback: switch owlrnd.com back to the previously deployed version.
# Uses your admin SSH key (OWLRND_SSH_KEY, default ~/.ssh/owlrnd-lightsail.pem).
set -euo pipefail
ssh -i "${OWLRND_SSH_KEY:-$HOME/.ssh/owlrnd-lightsail.pem}" "ubuntu@${OWLRND_HOST:-owlrnd.com}" "bash /opt/owlrnd/rollback.sh"
