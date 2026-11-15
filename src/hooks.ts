import type { Reroute } from '@sveltejs/kit';

/**
 * nginx serves `/<slug>/index.html` as the same file as `/<slug>/` (docs/adr/0001). Route it
 * the same way in the browser too, or the `[slug]` route sees "index.html" in the path and
 * shows "Story not found" once the page hydrates.
 */
export const reroute: Reroute = ({ url }) => {
	if (url.pathname.endsWith('/index.html')) return url.pathname.slice(0, -'index.html'.length);
};
