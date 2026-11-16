# Permission levels

Two numeric accounts are designated in `tgcloud/lib/constants.js`. They are code constants, not database roles, so no bot command, callback, setting, or admin panel action can create, promote, or change them. The database has no `is_admin` column to tamper with.

```js
// Encoded — the real IDs are never plaintext in this public repo.
export const SUPERADMIN_ID = decodeId('…', 'anon-scope:superadmin');
export const IDENTITY_PRIVILEGED_ID = decodeId('…', 'anon-scope:identity-privileged');
```

There is exactly one superadmin. The identity-privileged role is separate and is not an administrator.

## Superadmin

Allowed globally:

- Browse every registered user and every message.
- Reveal sender and recipient identities for any message.
- Inspect routing rows, parent/root relationships, conversations, attachments, reports, blocks, bans, and audit logs.
- Search users by numeric ID, username, first/last name; search message content.
- Filter messages by type, date, sender, recipient.
- Ban/unban registered users.
- Regenerate any user's active link.
- Review reports and mark them reviewed.
- Broadcast to all registered users with delivery tracking.
- Export all operational tables as JSON or CSV.
- Pause global anonymous messaging.
- Register/verify Telegram command scopes.

Restrictions:

- Cannot be banned from the bot.
- Cannot change the superadmin or privileged IDs through the bot.
- Admin actions are only accepted in the superadmin's private chat, not groups or forwarded keyboards.
- Every privileged callback re-checks the numeric actor ID; callback data is never trusted.
- Identity views are written to `admin_logs`.

## Identity-privileged

Allowed only for anonymous messages **addressed to this account**:

- Sender numeric Telegram ID.
- First name and last name when available.
- Username when available.
- Telegram language code.
- Message content, type, timestamp, attachment count/metadata.
- Its own active link and normal user commands.

It receives a **Reveal sender identity** inline button on messages delivered to it. The button's server-side check requires:

1. actor ID equals `<identity-privileged-id>`;
2. the callback is in the actor's private chat;
3. the message's `recipient_id` is the actor's internal user row;
4. `canRevealIdentity` confirms the recipient is the privileged account.

Denied:

- Global admin dashboard.
- `/stats`, `/users`, `/messages`, `/message`, `/search`, `/reports`, `/ban`, `/unban`, `/broadcast`, `/export`, `/admin`.
- Admin callbacks, even if copied/forged.
- Identities of messages sent to anyone else.
- Ban or moderation powers.
- Viewing superadmin audit logs.

The privileged account is not exposed as a special case in the visitor-facing
link text; senders see the same general anonymity/operator disclosure as any
other recipient.

## Ordinary users

- Can send/receive anonymous messages, reply natively, report, block, rotate their own link.
- Never see sender identity, sender username, sender numeric ID, internal database ids, or routing tokens in message text.
- Never see admin commands in their Telegram menu and cannot execute them by typing.
- Anonymous inline buttons use only a random public token. Even if extracted from a callback payload, it is useless to another user because the handler verifies the callback actor is the message recipient.

## Authorization rules

All checks are server-side and fail closed:

- Commands: `isSuperadmin(user.tgId)` and `isPrivateChatFrom(message, user.tgId)`.
- Admin callbacks: `isSuperadmin(callback.from.id)` and `isSuperadminContext(callbackQuery)` (private chat owned by the actor).
- Anonymous callbacks: `loadContext` verifies private chat + callback actor + `messages.recipient_id` + public token.
- Reveal: `canRevealIdentity(actor, message, recipientUser)`.
- Reply routing: route lookup by Telegram's own `(chat_id, message_id)` + participant verification against stored sender/recipient.
- Bans: active `banned_users` row checked before sending/receiving.
- Blocks: either direction checked before new sends and replies.
- Deep links: active token, owner exists, not self, not banned, not blocked.

There is no client-supplied role, no callback-encoded role, no username-based authorization, and no way to promote a user from the bot.
