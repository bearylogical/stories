import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	// Tailwind 4 runs as a Vite plugin; an inline (empty) PostCSS config stops Vite
	// from picking up a stray postcss.config.* from a parent directory.
	css: { postcss: { plugins: [] } }
});
