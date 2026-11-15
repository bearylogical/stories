import { loadStoryComponent } from '$lib/stories/component';
import type { PageLoad } from './$types';

// Runs in the browser too: loads only this Story's component.
export const load: PageLoad = async ({ data }) => ({
	...data,
	component: await loadStoryComponent(data.story.slug)
});
