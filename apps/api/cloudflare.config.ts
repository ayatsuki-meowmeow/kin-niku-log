import { defineConfig } from "cf/config";

/**
 * Secret-like files were detected but not read or migrated: .dev.vars, .dev.vars.example.
 * Only `secrets.required` entries are migrated.
 * See the Cloudflare Workers docs on configuring secrets for details.
 */

/**
 * cf migrate: dev,rules were not migrated because the Vite bundler is selected.
 * - dev.port (8080) is now configured via Vite's `server.port` in vite.config.ts.
 * - rules (Text import for *.yaml) is replaced by Vite's standard `?raw` import.
 */

export default defineConfig({
	worker: {
		name: "kin-niku-log-api",
		compatibilityDate: "2026-09-27",
		compatibilityFlags: [
			"nodejs_compat",
		],
		entrypoint: "src/index.ts",
	},
});
