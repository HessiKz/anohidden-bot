# Deployment and verification

## Credentials

There are two different things people often confuse:

| Credential | What it is | Where it goes |
|---|---|---|
| Telegram Serverless CLI access token | `app<id>:<secret>` from BotFather: bot → **Serverless** → **CLI Access** → **Access token** | `npx tgcloud login` → `.tgcloud/credentials` (mode 0600, gitignored) |
| Bot API token | The normal BotFather bot token | **Not required by this project.** The platform manages the webhook and Bot API access. |

Do not put either token in source, README, Git, command history, or logs. For CI, the CLI supports `TGCLOUD_TOKEN` in the environment. This project never reads or stores a Bot API token.

## Prerequisites

- Node.js 22.5+ locally (tests use `node:sqlite`; the deployed runtime is the platform V8 isolate).
- A Telegram bot created in BotFather and linked to Telegram Serverless.
- CLI access token from BotFather.
- The superadmin account (`<superadmin-id>`) and identity-privileged account (`<identity-privileged-id>`) must have started the bot at least once for chat-scoped command menus to be accepted.

## Deploy sequence

The platform applies code and database changes separately. Follow this order:

```sh
cd /home
npm install
npm run check
npm test

npx tgcloud login                 # paste CLI access token (hidden)
npx tgcloud status                # inspect local vs cloud changes
npx tgcloud push                  # deploy tgcloud/ modules + schema
npx tgcloud migrate --yes         # apply schema changes to SQLite (or run interactively)
npx tgcloud run endpoints/setup '{"action":"sync-commands"}'
npx tgcloud webhook               # confirm webhook and allowed updates
```

Why this order:

- `push` uploads modules and reports pending database changes, but never applies them.
- `migrate` is the explicit schema step. Running it after `push` ensures the schema module is present.
- `setup` registers and verifies commands after the handlers exist.
- `webhook` repairs drift if someone called `setWebhook` with a raw Bot API token.

`npx tgcloud webhook sync` can repair a mismatched webhook if needed.

## Verify command registration

The setup endpoint returns a report with one entry per scope:

- `default` — user commands.
- `superadmin` — user + admin commands.
- `identity_privileged` — user commands only.

Each entry is verified with `getMyCommands`; the endpoint retries a scope once, then reports a mismatch. Expected output is `"ok": true` with all three scopes. If a chat scope fails because the account has not started the bot, start it and re-run:

```sh
npx tgcloud run endpoints/setup '{"action":"sync-commands"}'
```

You can also trigger this from **Admin → Settings → Sync commands** and read the result in the settings panel.

## Live smoke verification

From Telegram:

1. **Superadmin** sends `/start`. Expect onboarding, one link, and a Share button.
2. **Superadmin** opens `/admin`. Expect the dashboard. If not, check that the numeric actor ID is `<superadmin-id>` and the chat is private.
3. **Identity-privileged** sends `/start`. Expect ordinary onboarding only.
4. **Identity-privileged** sends `/admin`. Expect “This command is not available.” and an `unauthorized_admin_command` audit row.
5. **Ordinary test account** sends `/admin`. Same denial.
6. **Ordinary test account** opens a second account's link (`/start <token>`), sends text, photo, and an album.
7. The recipient replies natively to the delivered message; the sender receives the reply. Reply again from the sender; the recipient receives it. This validates multi-level routing.
8. On a message to the privileged account, press **Reveal sender identity**. Expect a confidential identity card with numeric ID/name/username/language. On a message to an ordinary account, no reveal button appears, and forged callback data is denied.
9. Report a message; verify the superadmin notification and `/reports`. Mark it reviewed.
10. Block a sender; verify the persistent confirmation and that further sends/replies are refused.
11. Ban/unban a test user; verify `/ban`, `/unban`, and the user notifications.
12. Run `/broadcast` with a short text to a test audience; confirm preview, send in batches, and inspect success/failure counts.
13. Run `/export json`; verify a document arrives and opens.
14. Check `/admin` → Audit log for the sensitive actions.

## Operational checks

- `npx tgcloud status` — local vs cloud module changes.
- `npx tgcloud webhook` — webhook URL and allowed updates match deployed handlers.
- `npx tgcloud run handlers/message '<json>'` — execute a handler server-side without deploying (use synthetic data; do not use real private content).
- `npx tgcloud pull` — bring local state in line with cloud; review diffs before overwriting.

## Rollback

- Code: redeploy the previous commit with `npx tgcloud push`.
- Database: schema drops require `.deprecated()` and an explicit migration; there is no automatic destructive rollback. Take an export (`/export json`) before risky migrations.
- Credentials: if the CLI token leaks, revoke it in BotFather and run `npx tgcloud login` again.

## Environment limitations encountered in this sandbox

This workspace could not reach `cloud.telegram.org`, `api.telegram.org`, or
`t.me` directly (DNS/egress blocked). The official Serverless page was read
through an archived copy, and the project was built against the official CLI's
generated `AGENTS.md` and `docs/tgcloud-sdk.md`, the CLI's own source/schema, and
the official scaffold.

For this deployment only, a temporary Cloudflare Worker relay was used to reach
the Telegram Serverless management API and Bot API. It did not host the bot and
was deleted immediately after verification. The bot, database, and handlers
remain entirely on Telegram Serverless. See `docs/deployment-report.md`.
