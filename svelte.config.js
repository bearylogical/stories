import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// Static build served by nginx on Coolify — see docs/adr/0001.
		adapter: adapter({ pages: 'build', assets: 'build', fallback: '404.html', strict: true }),
		// Absolute asset paths so /<slug>, /<slug>/ and /<slug>/index.html all load the same assets.
		paths: { relative: false }
	},
	preprocess: vitePreprocess()
};

export default config;
