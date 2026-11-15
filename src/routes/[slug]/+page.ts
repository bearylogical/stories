import { error } from '@sveltejs/kit';
import { getStory, loadStoryComponent, stories } from '$lib/stories';
import type { EntryGenerator, PageLoad } from './$types';

// Only the Stories in this build are prerendered; Drafts are left out unless `includeDrafts`.
// With no Stories at all (only Drafts, in production), SvelteKit would fail the build over a
// prerenderable route with no pages, so the route is then simply not prerendered.
export const prerender = stories.length > 0;
export const entries: EntryGenerator = () => stories.map(({ slug }) => ({ slug }));

export const load: PageLoad = async ({ params }) => {
	const story = getStory(params.slug);
	if (!story) error(404, 'Story not found');
	return { story, component: await loadStoryComponent(story.slug) };
};
