import { error } from '@sveltejs/kit';
import { getStory, stories } from '$lib/stories';
import type { EntryGenerator, PageServerLoad } from './$types';

// `entries()` is how the Story list decides what gets built (docs/adr/0004): only the Stories
// this build serves are prerendered, so Drafts are left out unless `includeDrafts`.
// Workaround: if the build serves no Stories (say, only Drafts exist and this is a production
// build), `entries()` returns nothing and SvelteKit fails the build over a prerenderable route
// with no pages. So the route is then not prerendered at all; with adapter-static every Slug
// falls through to the 404 page, which is the right answer when there are no Stories.
export const prerender = stories.length > 0;
export const entries: EntryGenerator = () => stories.map(({ slug }) => ({ slug }));

// The Story's frontmatter comes from the Story list on the server (it is written into the
// prerendered page), so the browser never loads the list, and with it every other Story.
export const load: PageServerLoad = ({ params }) => {
	const story = getStory(params.slug);
	if (!story) error(404, 'Story not found');
	return { story };
};
