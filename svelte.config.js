import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { mdsvex } from 'mdsvex';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Stories are written in mdsvex (`.svx`) — see docs/adr/0004.
	extensions: ['.svelte', '.svx'],
	preprocess: [vitePreprocess(), mdsvex({ extensions: ['.svx'] })],
	kit: {
		// Static build served by nginx on Coolify — see docs/adr/0001.
		adapter: adapter({ pages: 'build', assets: 'build', fallback: '404.html', strict: true }),
		// Absolute asset paths so /<slug>, /<slug>/ and /<slug>/index.html all load the same assets.
		paths: { relative: false }
	}
};

export default config;
