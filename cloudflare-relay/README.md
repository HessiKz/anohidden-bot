# Cloudflare egress relay (temporary)

This Worker is **not** part of the bot runtime and does **not** host the bot. The bot runs on Telegram Serverless. The Worker was used only because this sandbox could not reach `cloud.telegram.org` directly; it forwards the official CLI management API and lets the operator call the Bot API through a relay.

It was deployed, used for the live deployment/verification, and then **deleted** from the Cloudflare account. Keep it only if you need to manage the Telegram bot from a network that cannot reach Telegram directly.

## Routes

| Path | Forwards to |
|---|---|
| `/tg/<RELAY_SECRET>/app<id>/manage/...` | `https://cloud.telegram.org/app<id>/manage/...` |
| `/bot/<RELAY_SECRET>/<method>` | `https://api.telegram.org/bot<BOT_TOKEN>/<method>` |
| `/bot/<RELAY_SECRET>/file/<path>` | `https://api.telegram.org/file/bot<BOT_TOKEN>/<path>` |

The bot token is a Worker secret and never appears in the request URL. The Telegram Serverless CLI token is passed through `Authorization` and is not stored by the Worker. `RELAY_SECRET` is a path capability; treat it as a password.

## Deploy

```sh
cd cloudflare-relay
npm install
# Create a 0600 file outside the repo:
# RELAY_SECRET=<openssl rand -hex 32>
# BOT_TOKEN=<BotFather bot token>
cf deploy --secrets-file /path/to/secrets.env
```

Set the CLI base URL to `https://<worker>/tg/<RELAY_SECRET>` via `TG_CLOUD_API_URL`, and use the normal Serverless CLI token via `TGCLOUD_TOKEN` or `npx tgcloud login`.

## Delete after use

```sh
cf workers delete cloudflare-relay --force
```

Rotate the bot token in BotFather if the relay secret or Cloudflare account may have been exposed.
