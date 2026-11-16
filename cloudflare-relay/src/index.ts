import { env as workerEnv } from "cloudflare:workers";

interface Env {
	RELAY_SECRET: string;
	BOT_TOKEN: string;
}

const CLOUD = "https://cloud.telegram.org";
const BOT = "https://api.telegram.org";

/**
 * A deliberately narrow egress relay.
 *
 * /tg/<secret>/app<id>/manage/...  -> https://cloud.telegram.org/app<id>/manage/...
 * /bot/<secret>/<method>           -> https://api.telegram.org/bot<BOT_TOKEN>/<method>
 * /bot/<secret>/file/<path>        -> https://api.telegram.org/file/bot<BOT_TOKEN>/<path>
 *
 * The bot token is a Worker secret and never appears in the request URL. The
 * Telegram Serverless CLI token is passed through Authorization and is never
 * stored by this Worker.
 */
export default {
	async fetch(request: Request): Promise<Response> {
		const env = workerEnv as unknown as Env;
		const url = new URL(request.url);
		const parts = url.pathname.split("/").filter(Boolean);
		if (parts.length < 3) return notFound();

		const [kind, secret, ...rest] = parts;
		if (!env.RELAY_SECRET || secret !== env.RELAY_SECRET) return notFound();
		if (!rest.length) return notFound();

		let target: URL;
		if (kind === "tg") {
			const path = rest.join("/");
			// Only the management API shape used by the official CLI.
			if (!/^app\d+\/manage(?:\/|$)/.test(path)) return notFound();
			target = new URL(`${CLOUD}/${path}${url.search}`);
		} else if (kind === "bot") {
			if (rest[0] === "file") {
				if (!env.BOT_TOKEN || rest.length < 2) return notFound();
				target = new URL(
					`${BOT}/file/bot${env.BOT_TOKEN}/${rest.slice(1).join("/")}${url.search}`
				);
			} else {
				if (!env.BOT_TOKEN) return notFound();
				target = new URL(
					`${BOT}/bot${env.BOT_TOKEN}/${rest.join("/")}${url.search}`
				);
			}
		} else {
			return notFound();
		}

		const headers = new Headers(request.headers);
		headers.delete("host");
		headers.delete("cf-connecting-ip");
		headers.delete("cf-ipcountry");
		headers.delete("cf-ray");
		headers.delete("cf-visitor");
		if (kind === "bot") headers.delete("authorization");

		try {
			const upstream = await fetch(target.toString(), {
				method: request.method,
				headers,
				body:
					request.method === "GET" || request.method === "HEAD"
						? undefined
						: request.body,
				redirect: "follow",
			});
			const responseHeaders = new Headers(upstream.headers);
			responseHeaders.delete("content-length");
			return new Response(upstream.body, {
				status: upstream.status,
				statusText: upstream.statusText,
				headers: responseHeaders,
			});
		} catch {
			// Never include the upstream URL: it may contain the bot token.
			return new Response(
				JSON.stringify({ ok: false, description: "relay upstream error" }),
				{ status: 502, headers: { "content-type": "application/json" } }
			);
		}
	},
} satisfies ExportedHandler<Env>;

function notFound(): Response {
	return new Response("Not found", { status: 404 });
}
