import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ command, mode }) => {
	const env = loadEnv(mode, process.cwd(), 'PUBLIC_');
	// Drafts are always in `vite dev`; a build includes them only with PUBLIC_INCLUDE_DRAFTS=true
	// (`pnpm build:drafts`, Coolify PR previews). See docs/adr/0004.
	const includeDrafts = command === 'serve' || env.PUBLIC_INCLUDE_DRAFTS === 'true';

	return {
		plugins: [tailwindcss(), sveltekit()],
		define: { __INCLUDE_DRAFTS__: JSON.stringify(includeDrafts) },
		// Tailwind 4 runs as a Vite plugin; an inline (empty) PostCSS config stops Vite
		// from picking up a stray postcss.config.* from a parent directory.
		css: { postcss: { plugins: [] } }
	};
});
