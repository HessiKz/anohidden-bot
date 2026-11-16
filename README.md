# Anonymous Telegram messaging platform

A production-oriented anonymous messaging bot that runs entirely on **Telegram Serverless** (`tgcloud`). Every user gets one random deep link. Anyone who opens it can send text, media, albums, contacts, locations, venues, and polls anonymously. Recipients answer with Telegram's native **Reply** feature, and the bot routes the reply back through an internal delivery map without revealing either side's identity.

There is no website, Mini App, external server, external database, Docker container, or third-party hosting. The runtime is Telegram's V8 isolate, the database is the platform's SQLite, and the only external API is Telegram's Bot API through the platform SDK.

## Languages (i18n)

The bot's **default language is Persian (فارسی)**. Every user-facing text —
onboarding, help, privacy model, anonymous-mode context, delivery
confirmations/failures, buttons, report reasons, and the whole admin panel —
is served from localized catalogs in `tgcloud/lib/i18n/`. English is a fully
supported secondary locale.

- `/language` opens a فارسی/English menu; the choice is stored per user in
  `users.ui_language` and every later message follows it.
- Persian output uses Persian digits and Jalali (Solar Hijri) dates computed
  without ICU (`tgcloud/lib/i18n/index.js`).
- Telegram command menus are registered per language: the fallback menu is
  Persian, and an `en` menu is registered for clients set to English, for the
  default, superadmin, and identity-privileged scopes alike.
- 18 commands exist (6 user + 12 admin); the registry version is
  `2026-11-16.2`. See `docs/deployment-report.md` for the live i18n verification.

## Status

Deployed to Telegram Serverless as `@anohiddenbot` (`app9248371819`) at revision 18 on 2026-11-16 (Persian-default i18n). The default, superadmin, and identity-privileged command scopes were verified with `getMyCommands`; the webhook is in sync; real anonymous delivery, native reply routing, privileged identity reveal, reports, report review, and export were exercised live. See [`docs/deployment-report.md`](docs/deployment-report.md) for the exact checks and residual limitations.

Cloudflare was used only as a temporary egress relay for this sandbox's CLI; the relay was deleted and the bot does not depend on Cloudflare.

## Why this repository is unusual

The local SDK is virtual. Production modules import `sdk` and `sdk/db`; those imports exist only inside Telegram Serverless. The repository includes a test-only mock SDK under `test/mock-sdk/` so the complete flows can be exercised locally with real SQLite (`node:sqlite`) and a faithful Bot API mock. Nothing under `test/` is deployed.

## Feature summary

- One active random link per user, with history preserved and immediate revocation on `/roll`.
- Anonymous text, photos, videos, voice, video notes, audio, documents, stickers, animations, contacts, locations, venues, dice, and polls.
- Media groups delivered as Telegram albums (`copyMessages`) with a control message for Reply / Report / Block.
- Native-reply routing with arbitrary reply depth and media replies.
- Inline **Reply**, **Report**, **Block**, and (for authorized accounts only) **Reveal sender** actions.
- Reports, blocking, global bans, and a superadmin audit trail.
- Full in-Telegram admin panel: overview, user explorer, message explorer, filters, reports, broadcasts, JSON/CSV export, settings, command sync.
- Separate immutable roles:
  - **SUPERADMIN** `564873641` — global access.
  - **IDENTITY_PRIVILEGED** `8134382349` — can reveal senders only for messages addressed to that account; no admin access.
- Command registration through `setMyCommands`, verification through `getMyCommands`, with default, superadmin, and privileged chat scopes.
- Update deduplication, opaque callback handles, fail-closed authorization, rate limits, and no user-facing deletion.

## Quick start (development)

```sh
npm install
npm run check          # syntax-check every deployed module
npm test               # local integration suite with mock SDK + SQLite
```

The tests do not call Telegram and do not require credentials.

## Deploy to Telegram Serverless

The CLI token is **not** a Bot API token. Get it from BotFather: your bot → **Serverless** → **CLI Access** → **Access token**. It has the shape `app<id>:<secret>`.

```sh
npx tgcloud login                  # interactive; stores .tgcloud/credentials (gitignored)
npx tgcloud status                 # review local vs cloud
npx tgcloud push                   # deploy handlers, lib, schema, endpoints
npx tgcloud migrate --yes          # apply schema changes to SQLite (CI-safe)
npx tgcloud run endpoints/setup '{"action":"sync-commands"}'
npx tgcloud webhook                # verify webhook + allowed updates
```

`push` never applies migrations. Run `push` first, then `migrate`, as documented by the platform. The setup endpoint is safe to call through the CLI with no context; over HTTP the platform verifies Mini App init data and the endpoint additionally requires the superadmin account.

After deployment, open the bot and send `/start` from the superadmin account and from the identity-privileged account so Telegram can create chat-scoped command menus. Re-run command sync if either account had never started the bot.

## Commands

### Default user menu

| Command | Description |
|---|---|
| `/start` | Register, create/reuse the user's one active link, or open a deep link. |
| `/help` | Explain anonymous sending, native replies, and controls. |
| `/link` | Show the caller's active anonymous link. |
| `/roll` | Revoke the active link and create a new one. |
| `/about` | Privacy model and retention disclosure. |

### Superadmin menu (registered only in the superadmin's chat scope)

| Command | Description |
|---|---|
| `/admin` | Admin dashboard. |
| `/stats` | Platform statistics and recent activity. |
| `/users [page]` | Browse registered users. |
| `/user <telegram_id>` | Inspect one user by Telegram numeric ID. |
| `/messages [page] [--type=] [--days=] [--sender=] [--recipient=]` | Global message explorer. |
| `/message <internal_id>` | Full message detail, identities, routes, parent. |
| `/search <query>` | Search users (ID/username/name) and message text. |
| `/reports [page]` | Open reports. |
| `/ban <telegram_id> [reason]` | Ban a registered user. |
| `/unban <telegram_id>` | Unban a user. |
| `/broadcast` | Compose a tracked broadcast (preview → confirm → batched delivery). |
| `/export [json|csv]` | Send a database export as a Telegram document. |

Ordinary users and the identity-privileged account do not see and cannot execute admin commands. Authorization is checked against the numeric actor ID on every command and callback; callback data is never trusted for privilege.

## Permission model

| Capability | Ordinary user | Identity-privileged | Superadmin |
|---|---|---|---|
| Send/receive anonymous messages | yes | yes | yes |
| See identities of people messaging them | never | only messages addressed to that account | globally |
| Admin dashboard / admin callbacks | no | no | yes |
| Ban/unban, broadcast, export, audit log | no | no | yes |
| Change roles or superadmin ID | no | no | no (code constants) |

The identity-privileged account is not an administrator. It receives one extra inline button — **Reveal sender identity** — only on messages delivered to it. The check is server-side: actor ID + message recipient + private chat. The superadmin can inspect the same identities globally through the admin message explorer.

## Message and reply routing

When Alice sends to Bob:

1. A deep link resolves to Bob's internal user row and sets a short-lived pending target for Alice.
2. Alice's Telegram message is copied with `copyMessage` (or `copyMessages` for an album) from Alice's chat with the bot to Bob's chat.
3. The internal `messages` row stores `sender_id`, `recipient_id`, `conversation_id`, parent/root, type, source chat/message, delivery status, and a random public callback token.
4. A `message_routes` row maps `(Bob's chat id, delivered Telegram message id)` → internal message id.
5. Bob replies natively to the delivered message. The bot reads `reply_to_message.message_id` and the current chat id, looks up the route, verifies Bob is a participant, and delivers Bob's reply to Alice. A new route is created in Alice's chat, so the next reply routes back.
6. This repeats indefinitely, including media replies and replies to album items. A control message after an album is also routed to the album's first item.

The bot never routes a reply from a user-supplied internal ID, username, or callback value. If a reply target has no route, it explains how to reply rather than guessing. The Reply inline button only shows that instruction; it does not start a wizard.

## Media and albums

Single messages use `copyMessage`, preserving entities, captions, and media without downloading bytes. If Telegram refuses a copy, type-specific fallbacks (`sendMessage`, `sendPhoto`, `sendPoll`, …) are attempted only for definite Bot API errors. Network failures are not retried blindly, which avoids duplicate deliveries. Messages marked `has_protected_content` are refused with a clear error instead of being re-sent, and messages with a forward header are re-sent without the header rather than copied.

Albums are accumulated briefly by `media_group_id`, claimed atomically in SQLite, and copied with `copyMessages` so Telegram keeps them grouped. A control message carries the buttons and a route. Telegram does not guarantee that all album updates arrive before the first handler finishes; the settle window is a best effort. A late item may form a second group. The delay is configurable with `ALBUM_SETTLE_MS` (milliseconds). Albums containing forwarded items are re-sent item-by-item to strip Telegram forward headers, so those albums may lose grouping.

Unsupported/protected types produce a clear sender-facing error, never a false success.

## Database

The schema lives in `tgcloud/schema.js` and has no foreign keys (the platform disables them). Integrity is enforced with unique constraints and application logic. Main tables:

`users`, `user_links`, `pending_targets`, `conversations`, `messages`, `message_routes`, `message_attachments`, `blocked_users`, `reports`, `banned_users`, `processed_updates`, `admin_logs`, `platform_settings`, `admin_states`, `broadcasts`, `broadcast_deliveries`, `rate_limits`.

Messages and link history are retained. There is no user-facing delete and no automatic purge. Expired pending contexts and admin compose states are the only short-lived rows removed.

## Security properties

- Numeric Telegram IDs are the only authorization source. Usernames are display data, never credentials.
- Admin commands and callbacks verify the actor and the private chat on the server. The identity-privileged account fails every admin check.
- Identity disclosure verifies the actor, the message recipient, and the private chat; ordinary users are denied even with forged callback data.
- Callback data uses random public tokens for recipient actions, not internal database IDs or sender IDs.
- Reply routing uses Telegram's own `(chat_id, message_id)` reply reference and re-verifies conversation participation.
- Update IDs are deduplicated in `processed_updates`; message source `(chat_id, message_id)` is unique.
- Blocks are checked in both directions for safety and sever the conversation; bans are reversible.
- Deep-link tokens come from a cryptographic RNG with no `Math.random` fallback. If secure randomness is unavailable, link creation fails closed.
- Bot credentials are never in source, README, logs, or Git. The CLI keeps its token in `.tgcloud/credentials` (gitignored).

## Repository map

```
tgcloud/
  schema.js                 SQLite schema and indexes
  handlers/                 message + callback_query update handlers
  lib/
    constants.js            immutable roles, limits, callback prefixes
    flow/                   message/callback orchestration and native reply routing
    services/               users, links, messages, delivery, moderation, reports, stats, export
    admin/                  admin commands, callbacks, data, keyboards, broadcast, export
    telegram/               Bot API wrappers, keyboards, command registry
    ui/                     user and admin message formatting
    util/                   tokens, HTML, time, validation, logging
  endpoints/setup.js        explicit command-sync setup step (CLI/superadmin)
docs/                       architecture, commands, permissions, deployment, testing
test/                       local mock SDK, integration tests, smoke test
cloudflare-relay/           optional temporary CLI egress relay (not bot runtime)
```

## Operational notes

- Rotate a user's link with `/roll`; old tokens immediately fail but old conversations keep working.
- Pause all anonymous sending from Admin → Settings (admin functions continue).
- Reports notify the superadmin with a direct “Ban sender” action.
- Broadcasts are batched to respect Telegram rate limits. Each recipient has a unique delivery row; a crash can leave a delivery `pending`, which is shown rather than silently retried and duplicated.
- The command menu is versioned in `platform_settings`. Re-run `npm run setup:commands` after changing the registry.

## License

Private project. No license granted for redistribution.
