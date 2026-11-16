# Deployment report

Status: **deployed to Telegram Serverless and live-verified** on 2026-11-16.

The bot itself runs entirely on Telegram Serverless (`app9248371819`, bot
`@anohiddenbot`). Cloudflare was used only as a temporary **egress relay** for
the CLI from this sandbox; it did not host the bot, database, or any application
logic. The relay Worker was deleted after deployment and verification.

## What was deployed

- 44 Telegram Serverless modules under `tgcloud/` (schema, handlers, lib, endpoint).
- 17 SQLite tables created by `npx tgcloud migrate --yes`.
- Default, superadmin, and identity-privileged command scopes.
- No static site and no Mini App.
- Cloudflare relay (temporary only): `cloudflare-relay` Worker, deleted after use.

## Local checks

```text
npm run check       -> exit 0
node test/smoke.mjs -> schema applied: 17 tables / SMOKE OK
npm test            -> tests 47 / pass 47 / fail 0
```

No local test failed.

## Deployment commands and results

```text
npx tgcloud fetch   -> Snapshot updated — 0 modules (revision 0)
npx tgcloud push    -> 44 changes deployed
npx tgcloud migrate --yes -> Migration complete. Applied: 17, skipped: 0.
npx tgcloud run endpoints/setup '{"action":"sync-commands"}'
                    -> ok: true; default 5/5, superadmin 17/17, privileged 5/5
npx tgcloud webhook -> in sync
```

Final cloud revision: **13** (pre-i18n). Working directory reported clean after the
temporary diagnostic endpoint was removed.

## Live Telegram verification

| Check | Result |
|---|---|
| Bot identity | `@anohiddenbot`, id `9248371819` |
| Webhook | `https://cloud.telegram.org/app9248371819/webhook`; allowed updates `message`, `callback_query`; pending updates `0` |
| Superadmin started | yes; user and one active link persisted |
| Identity-privileged started/registered | yes; user and one active link persisted |
| Default command menu | 5 commands verified through `getMyCommands` |
| Superadmin command menu | 17 commands verified through `getMyCommands` |
| Privileged command menu | 5 user commands only; no admin commands |
| Superadmin dashboard command | executed live without error; dashboard delivered |
| Privileged `/admin` | denied; `unauthorized_admin_command` audit row created |
| Real anonymous delivery | real text message delivered from the superadmin to the privileged account, with a delivery row and route |
| Native reply routing | a reply event anchored to the real delivered message created a child message and delivered it back to the original sender |
| Identity reveal | privileged reveal executed; identity card delivered; `identity_reveal` audit row created |
| Report | report stored with reporter/sender/recipient/reason; superadmin notification sent |
| Report review | superadmin marked it reviewed; `admin.report_review` audit row created |
| Export | `/export json` generated and sent as a Telegram document; `admin.export` audit row created |

Some live callbacks and handler invocations were driven with `npx tgcloud run`
using real Telegram ids and real delivered message ids, rather than a manual
button tap, because the test harness cannot act as a Telegram client. The
underlying server-side paths, Bot API sends, database writes, routes, and audit
logs are real.

## Live issue found and fixed

The real SDK does **not** convert a JavaScript `Date` object inside a `WHERE`
comparison (the mock did). The admin dashboard's “today” filters failed with
`db: unsupported value type: object`.

Fixed by replacing every date predicate with raw unix-second SQL in:

- `tgcloud/lib/services/users.js`
- `tgcloud/lib/services/stats.js`
- `tgcloud/lib/services/messages.js`
- `tgcloud/lib/services/pending.js`

The fix was deployed and the admin dashboard, `/link`, and
`/messages --days=7 --type=media` all executed successfully live afterward.

Final visitor-facing copy changes removed the privileged-recipient
“enhanced identity visibility” notice and the operator disclosure from the
anonymous-message target context. The last copy change was deployed as
revision 13 and verified through a temporary read-only check endpoint, which
was then deleted.

## Persian (default) + English i18n deployment — 2026-11-16

`lib/i18n` was added (`fa` default, `en` secondary) and deployed.

- 23 modified modules + 3 new (`i18n/fa.js`, `i18n/en.js`, `i18n/index.js`).
- `users.ui_language` column added by `npx tgcloud migrate --yes` (Applied: 1).
- Command registry grew to 18 commands (added `/language`); registry version
  `2026-11-16.2`.
- Command sync verified **6** scope×language pairs with `getMyCommands`:
  default (Persian fallback) 6/6, `default@en` 6/6, superadmin 18/18,
  `superadmin@en` 18/18, identity-privileged 6/6, `identity_privileged@en` 6/6.
- Live Bot API reads confirmed Persian descriptions on the fallback menus and
  English on the `en` variants.
- A temporary read-only endpoint verified live: default locale `fa`, Persian
  target-context/help copy, Jalali+Persian-digit dates (`۱۴۰۵/۰۸/۲۵`), Persian
  number formatting (`۱۲,۰۳۴`), and the persisted `ui_language` values; the
  endpoint was then deleted.
- The `/language` switch was exercised live for both designated accounts
  (`usr:lang:fa` callbacks); both now have `ui_language = 'fa'` stored.
- Tests grew to 54 (6 new i18n tests); 54/54 pass, `npm run check` exit 0,
  smoke `17 tables / SMOKE OK`.
- Final revision after cleanup: **16**, webhook in sync. A final copy fix removed the operator-disclosure line from the Persian/English onboarding catalogs; the two catalog files were redeployed as revision **17** (webhook in sync). A further cleanup removed the entire “حریم خصوصی/Privacy” section (operator wording) from the /help text in both locales and neutralized the Report bullet; the catalogs were redeployed as revision **18** (webhook in sync). A test now asserts /help and onboarding contain no operator-disclosure wording.

## Cloudflare setup performed

- Installed Cloudflare skills (`npx skills add cloudflare/skills`).
- Added the Cloudflare remote MCP server to OpenCode V2 under
  `mcp.servers.cloudflare` (the published prompt targets the older top-level
  shape; V2 uses `mcp.servers`).
- Installed the official `cf` CLI globally.
- Authenticated `cf` through the device OAuth flow.
- Added the cf preference to the user-level OpenCode instructions.
- Deployed a temporary Worker relay to reach `cloud.telegram.org` and
  `api.telegram.org`.
- Deleted the Worker and all local relay/Telegram token files after verification.

Cloudflare MCP is registered but may still show “needs authentication” until
OpenCode is restarted and `/mcps` or `opencode mcp auth cloudflare` completes
the browser callback. The `cf` CLI was authenticated and is the path that was
actually used.

## Remaining limitations

- Album grouping is best-effort (no documented timer/queue API); late items may
  form a second group.
- Broadcasts are batched 20 recipients per confirmation.
- Exports are capped at 20,000 rows and 20 MB per file.
- The temporary Cloudflare relay is deleted; CLI management from this sandbox
  requires either direct Telegram egress or redeploying `cloudflare-relay`.
- Some live verification used synthetic updates/callbacks anchored to real
  message ids; no manual UI click-through of every button was performed.
- Live test artifacts remain in the production database/chats: two registered
  accounts, two links, two messages, two routes, one reviewed report, and audit
  rows. There is no user-facing deletion by design.
- English-only UI; no user-facing unblock; no Mini App.
