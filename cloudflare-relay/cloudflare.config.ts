import { bindings, defineConfig } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

export default defineConfig({
	worker: {
		name: "cloudflare-relay",
		compatibilityDate: "2026-11-13",
		entrypoint,
		env: {
			RELAY_SECRET: bindings.secret(),
			BOT_TOKEN: bindings.secret(),
		},
	},
});
