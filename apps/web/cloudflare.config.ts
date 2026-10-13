import { defineConfig } from "cf/config";

export default defineConfig({
	worker: {
		name: "kin-niku-log",
		compatibilityDate: "2026-09-27",
		assets: {
			notFoundHandling: "single-page-application",
		},
		previewUrls: false,
	},
});
