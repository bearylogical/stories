/**
 * Loads one Story's mdsvex component. Safe in the browser: each Story is its own chunk,
 * fetched only when its page is opened. The Story list (`./index.ts`) is server-side only.
 */
import type { Component } from 'svelte';
import { bySlug } from './files';

// The pattern is `STORY_FILES` (./files.ts), written out because Vite requires a literal.
const components = bySlug(
	import.meta.glob<Component>('/src/stories/*/index.svx', { import: 'default' })
);

export async function loadStoryComponent(slug: string): Promise<Component> {
	const load = components[slug];
	if (!load) throw new Error(`No Story with Slug "${slug}"`);
	return load();
}
