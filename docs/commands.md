# Bot commands and registration

The canonical registry is `tgcloud/lib/telegram/commands.js`. Every command handled by the bot is listed there. `validateCommandRegistry()` enforces Telegram's limits:

- command: 1–32 characters, `a-z`, `0-9`, `_`
- description: 3–256 characters
- no duplicates across groups

Registration is performed with `setMyCommands`, then verified with `getMyCommands`. The setup module is `endpoints/setup.js`:

```sh
npx tgcloud run endpoints/setup '{"action":"sync-commands"}'
```

It can also be triggered from **Admin → Settings → Sync commands**. Over HTTP, the endpoint requires superadmin Mini App init data (the platform verifies it); a normal user receives `400 FORBIDDEN`. A CLI invocation with no context is allowed because CLI access already grants deployment authority.

## Scopes

| Scope | Commands |
|---|---|
| `{type: "default"}` (fallback = Persian) | `/start`, `/help`, `/link`, `/roll`, `/about`, `/language` |
| `{type: "default"}` + `language_code: "en"` | the same commands, English descriptions |
| `{type: "chat", chat_id: 564873641}` | all user + all admin commands (Persian fallback + `en` variant) |
| `{type: "chat", chat_id: 8134382349}` | all user commands only (Persian fallback + `en` variant) |

Each scope is registered twice: without a language code (the fallback — Persian, the platform default) and with `language_code: "en"`. Sync and verification (`getMyCommands`) run for every scope × language pair. The chat scope overrides the default menu for that chat. Ordinary users therefore never see admin commands. The identity-privileged account sees only the user menu and has no admin handlers.

If either designated account has never started the bot, Telegram may reject its chat scope. The sync report shows the failure; start the bot from that account and re-run sync.

## User commands

### `/start`

- No argument: register/refresh the user, reuse the one active link (create it only if missing), show onboarding and privacy disclosure.
- `/start <token>`: resolve a deep link. Validates the token, active state, self-send, ban state, block relationship, and global pause. Sets a one-hour temporary target and asks for a message.

### `/help`

Explains anonymous sending, native Reply routing, Report/Block, link rotation, and the privacy model. Inline buttons: My link, How replies work, Privacy. For the superadmin it also mentions `/admin`.

### `/link`

Shows the caller's active link and a Share button. Clears any pending target context.

### `/roll`

Revokes the current link immediately, preserves the historical row, creates a new random token, and shows the new link. Limited to 5 rotations per hour. Existing conversations and replies are unaffected.

### `/language`
Opens a two-button menu (فارسی / English). The choice is stored in `users.ui_language`; every later message, keyboard, and confirmation follows it. The default for anyone without a choice is Persian.

### `/about`

Full privacy disclosure: anonymity is between users; the superadmin can inspect identities globally; a separate identity-privileged account can see senders only for messages addressed to it; messages are retained; no user-facing delete.

## Superadmin commands

Authorization: numeric actor ID `564873641`, private chat only, checked server-side for the command and its callbacks. Callback data never grants authority.

### `/admin`

Dashboard with total/new users, total/today messages, replies, reports/open reports, banned users, blocks, active links, failed deliveries, and recent users/messages/reports. Buttons open every admin section.

### `/stats`

Same overview data; useful as a quick command.

### `/users [page]`

Paginated user list (8 per page). Each user button opens details.

### `/user <telegram_id>`

User detail: name, username, numeric ID, language, registration/last activity, active link URL, historical link count, sent/received counts, conversations, reports filed/against, blocks made/received, ban status. Actions: sent/received/all messages, blocks, ban/unban, regenerate link.

### `/messages [page] [--type=all|text|media|failed] [--days=1|7|30] [--sender=<tg_id>] [--recipient=<tg_id>]`

Global message explorer. The inline UI also exposes type and date filters. Each row opens full details. Sender/recipient filters accept numeric Telegram IDs and are resolved to internal ids.

Example:

```text
/messages 1 --type=media --days=7 --sender=123456789
```

### `/message <internal_id>`

Full message detail: content, type, status, timestamps, sender and recipient identities, attachments/file metadata, source and delivered Telegram references, parent, conversation, routes, report count. Buttons: parent, conversation, sender, recipient, ban sender, report, back.

The ID is the internal `messages.id` shown in the explorer, not a Telegram message id.

### `/search <query>`

- Numeric query: exact Telegram ID user match plus message-text matches.
- Text query: username, first name, last name (case-insensitive ASCII) and message content/caption.

Shows up to 8 users and 8 messages with action buttons.

### `/reports [page]`

Open reports. Inline buttons switch to reviewed/all. Report detail shows reason, status, reporter, reported sender, recipient, content, attachments; actions: mark reviewed, open message, ban sender.

### `/ban <telegram_id> [reason]`

Bans a registered user. The superadmin cannot be banned. The target is notified. Banned users cannot send, reply, rotate links, or receive deliveries; `/help` and `/about` still work.

### `/unban <telegram_id>`

Reactivates a banned user and notifies them.

### `/broadcast`

Enters compose mode. The next non-command message is stored as a preview. Confirm sends in batches of 20; Cancel aborts. Supported: text and single media/contact/location/venue/poll. Albums are rejected. Delivery is tracked per user with a unique row, and a crash leaves a visible pending row rather than risking a duplicate.

### `/export [json|csv]`

- `json`: one document containing every operational table (up to 20,000 rows per table) plus counts/truncation flags.
- `csv`: separate `users.csv` and `messages.csv` documents.

Generated in memory and sent with `InputFile`; no filesystem.

## Inline callbacks (not commands)

| Prefix | Purpose |
|---|---|
| `usr:` | Help, link, privacy, reply instructions. Verified private chat. |
| `anon:reply:` | Shows the native-reply instruction. Recipient only. |
| `anon:report:` | Opens report reason buttons. Recipient only. |
| `anon:rr:` | Stores a report (unique per message/reporter). |
| `anon:block:` | Creates a directional block and a persistent confirmation. |
| `anon:reveal:` | Identity disclosure; superadmin globally, identity-privileged only for messages addressed to it. |
| `adm:` | Complete admin panel. Superadmin + private chat required. |

Every displayed button has a handler. Unknown or stale callback data receives a friendly answer.
