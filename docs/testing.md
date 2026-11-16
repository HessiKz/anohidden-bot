# Testing

The production modules import the virtual `sdk` and `sdk/db`. The local test harness registers a Node ESM loader that maps those names to `test/mock-sdk/`, which implements the documented SDK surface with real SQLite (`node:sqlite`) and an in-memory Bot API mock.

No Telegram credentials, network access, or external services are used by the tests.

```sh
npm test          # ALBUM_SETTLE_MS=50 node --test test/*.test.mjs
npm run smoke     # schema + CRUD smoke test
npm run check     # syntax-check every deployed module
```

## Required coverage

| # | Behavior | Test file |
|---|---|---|
| 1 | New user registration | `test/registration.test.mjs` |
| 2 | Existing user registration is idempotent | `test/registration.test.mjs` |
| 3 | Unique cryptographically random links | `test/links.test.mjs` |
| 4 | Link regeneration invalidates the old token | `test/links.test.mjs` |
| 5 | Anonymous text delivery | `test/messaging.test.mjs` |
| 6 | Media delivery | `test/messaging.test.mjs` |
| 7 | Album delivery as one group | `test/albums.test.mjs` |
| 8 | Anonymous reply routing | `test/replies.test.mjs` |
| 9 | Multi-level reply routing | `test/replies.test.mjs` |
| 10 | Block functionality | `test/moderation.test.mjs` |
| 11 | Report functionality | `test/moderation.test.mjs` |
| 12 | Ban/unban functionality | `test/moderation.test.mjs` |
| 13 | Superadmin access | `test/admin.test.mjs` |
| 14 | Identity-privileged reveal | `test/privileged.test.mjs` |
| 15 | Unauthorized identity denial | `test/privileged.test.mjs` |
| 16 | Unauthorized admin denial | `test/admin.test.mjs` |
| 17 | Duplicate update prevention | `test/reliability.test.mjs` |
| 18 | Pagination | `test/admin.test.mjs` |
| 19 | Command registration + verification | `test/commands.test.mjs` |
| 20 | Database persistence | `test/persistence.test.mjs` |
| 21 | Poll fallback (regular + quiz + missing answer) | `test/extended.test.mjs` |
| 22 | Broadcast batches of 20 and completion | `test/extended.test.mjs` |
| 23 | Admin media/failure filters | `test/extended.test.mjs` |
| 24 | CSV export content | `test/extended.test.mjs` |
| 25 | Rate limiter budget | `test/extended.test.mjs` |
| 26 | Banned recipient cannot receive | `test/extended.test.mjs` |

Additional cases: self-link rejection, invalid/inactive token, reply to an unrelated bot message, duplicate callback replay, forged callback data, malformed update, blocked-direction replies, album routes, report uniqueness, broadcast duplicate prevention, export generation.

## What the mock does and does not prove

It proves project logic, SQL shape, authorization, routing, deduplication, and formatting against the documented SDK contract. It does **not** prove the real Telegram Serverless runtime's V8 capabilities (for example whether `setTimeout` exists or whether the platform's SQLite accepts every DDL clause). Those must be verified with `npx tgcloud run`, deployment, and the live bot.

## Actual results

Executed on the workspace tree:

```text
npm test
# tests 47
# pass 47
# fail 0
# duration_ms ~14s
```

`node test/smoke.mjs` printed `schema applied: 17 tables` and `SMOKE OK`.
`npm run check` exited 0 for every deployed `.js` file.

Live platform checks after deployment (webhook, three command scopes, real
anonymous delivery, reply routing, privileged reveal, report/review, export) are
recorded in `docs/deployment-report.md`. Planned checks are not reported as
passed.
