import { error } from '@sveltejs/kit';
import { getStory, stories } from '$lib/stories';
import type { EntryGenerator, PageServerLoad } from './$types';

// Only the Stories in this build are prerendered; Drafts are left out unless `includeDrafts`.
// With no Stories at all (only Drafts, in production), SvelteKit would fail the build over a
// prerenderable route with no pages, so the route is then simply not prerendered.
export const prerender = stories.length > 0;
export const entries: EntryGenerator = () => stories.map(({ slug }) => ({ slug }));

// The Story's frontmatter comes from the Story list on the server (it is written into the
// prerendered page), so the browser never loads the list, and with it every other Story.
export const load: PageServerLoad = ({ params }) => {
	const story = getStory(params.slug);
	if (!story) error(404, 'Story not found');
	return { story };
};
