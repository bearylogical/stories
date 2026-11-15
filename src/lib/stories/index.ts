/**
 * The Story list: every Story in `src/stories/<slug>/index.svx`, newest first.
 * The Front Page, RSS and the `[slug]` route's `entries()` all read it (docs/adr/0004).
 */
import type { Component } from 'svelte';
import { parseFrontmatter } from './frontmatter';
import type { Story } from './types';

export type { Story, StoryMeta, StorySource, StoryStatus } from './types';

/**
 * Whether Drafts are part of this build: always in `vite dev`, and in a build only with
 * `PUBLIC_INCLUDE_DRAFTS=true` (`pnpm build:drafts`, PR previews). Set in `vite.config.ts`.
 */
export const includeDrafts: boolean = __INCLUDE_DRAFTS__;

// Frontmatter only; mdsvex exports it as `metadata`. Validated here, so a bad Story
// fails `vite build` while prerendering instead of breaking a reader's page.
const frontmatter = import.meta.glob<Record<string, unknown>>('/src/stories/*/index.svx', {
	eager: true,
	import: 'metadata'
});

// The Story components themselves, loaded only when their page is opened.
const components = import.meta.glob<Component>('/src/stories/*/index.svx', { import: 'default' });

const pathOf = (slug: string) => `/src/stories/${slug}/index.svx`;
const slugOf = (path: string) => path.split('/').at(-2)!;

const byNewest = (a: Story, b: Story) =>
	b.published.localeCompare(a.published) || a.slug.localeCompare(b.slug);

/** Every Story in the repo, Drafts included, newest first. */
export const allStories: Story[] = Object.entries(frontmatter)
	.map(([path, data]) => ({ slug: slugOf(path), ...parseFrontmatter(slugOf(path), data) }))
	.sort(byNewest);

/** The Stories this build serves: published ones, plus Drafts when `includeDrafts` is on. */
export const stories: Story[] = allStories.filter(
	(story) => includeDrafts || story.status === 'published'
);

/** Published Stories only, whatever the build (for RSS). */
export const publishedStories: Story[] = allStories.filter((story) => story.status === 'published');

/** The Story at this Slug, if this build serves it. */
export function getStory(slug: string): Story | undefined {
	return stories.find((story) => story.slug === slug);
}

/** Loads the Story's mdsvex component. */
export async function loadStoryComponent(slug: string): Promise<Component> {
	const load = components[pathOf(slug)];
	if (!load) throw new Error(`No Story at ${pathOf(slug)}`);
	return load();
}
