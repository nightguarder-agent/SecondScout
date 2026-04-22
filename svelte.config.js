import adapter from '@sveltejs/adapter-netlify';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter(),
		alias: {
			"$env/dynamic/private": "./src/lib/server/env-mock.ts",
			"$env/dynamic/public": "./src/lib/server/env-mock.ts",
			"$env/static/private": "./src/lib/server/env-mock.ts",
			"$env/static/public": "./src/lib/server/env-mock.ts"
		}
	}
};

export default config;
