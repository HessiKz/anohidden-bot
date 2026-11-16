#!/usr/bin/env bash
# Deploy the anonymous Telegram messaging bot to Telegram Serverless.
#
# Prerequisites:
#   - Outbound access to cloud.telegram.org / Telegram
#   - TGCLOUD_TOKEN=app<id>:<secret> in the environment, or run
#     `npx tgcloud login` once interactively
#   - The superadmin and identity-privileged accounts have started the bot
#
# This script never prints the token. It stops on the first failure.

set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${TGCLOUD_TOKEN:-}" ] && [ ! -f .tgcloud/credentials ]; then
  echo "No CLI credential found." >&2
  echo "Run: npx tgcloud login" >&2
  echo "or set TGCLOUD_TOKEN=app<id>:<secret> in the environment." >&2
  exit 1
fi

echo "==> Local checks"
npm run check
npm test
node test/smoke.mjs

echo "==> Inspect cloud state (review before overwriting unrelated work)"
npx tgcloud status

echo "==> Deploy modules (does not touch the database)"
npx tgcloud push

echo "==> Apply schema migration"
npx tgcloud migrate --yes

echo "==> Register and verify Telegram command scopes"
npx tgcloud run endpoints/setup '{"action":"sync-commands"}'

echo "==> Webhook status"
npx tgcloud webhook

cat <<'EOF'

Deployment finished. Now verify live from Telegram:

  1. Superadmin /start -> onboarding + link
  2. Superadmin /admin -> dashboard
  3. Privileged /start -> ordinary onboarding
  4. Privileged /admin -> denied
  5. Ordinary test account /admin -> denied
  6. Open a test link, send text/photo/album, reply natively, reply again
  7. Privileged reveal on its own messages; ordinary reveal denied
  8. Report -> /reports -> review
  9. Block -> further sends/replies refused
 10. Ban/unban
 11. /broadcast preview + confirm + continuation
 12. /export json and /export csv

If a chat-scoped command menu fails, start the bot from that account and re-run:
  npx tgcloud run endpoints/setup '{"action":"sync-commands"}'
EOF
