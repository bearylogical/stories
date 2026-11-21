/**
 * Builds the Story list from raw frontmatter, with no Vite or build globals involved,
 * so it can be tested with sample Stories. `./index.ts` feeds it the real Stories.
 */
import { parseFrontmatter } from './frontmatter';
import type { Story } from './types';

export interface StoryList {
	/** Every Story, Drafts included, newest first. */
	all: Story[];
	/** The Stories this build serves: published ones, plus Drafts when `includeDrafts` is on. */
	stories: Story[];
	/** Published Stories only, whatever `includeDrafts` says (for RSS). */
	published: Story[];
}

const byNewest = (a: Story, b: Story) =>
	b.published.localeCompare(a.published) || a.slug.localeCompare(b.slug);

/**
 * The Story list for one build. `frontmatter` maps each Slug to its Story's unchecked
 * frontmatter; every entry is validated with `parseFrontmatter`, so one bad Story throws
 * (and fails the build) rather than being skipped. Newest first; same-day Stories by Slug.
 */
export function selectStories(
	frontmatter: Record<string, unknown>,
	{ includeDrafts }: { includeDrafts: boolean }
): StoryList {
	const all = Object.entries(frontmatter)
		.map(([slug, data]): Story => ({ slug, ...parseFrontmatter(slug, data) }))
		.sort(byNewest);
	const published = all.filter((story) => story.status === 'published');
	return { all, stories: includeDrafts ? all : published, published };
}

/** The Story at this Slug in `stories`, if there is one. */
export function findStory(stories: Story[], slug: string): Story | undefined {
	return stories.find((story) => story.slug === slug);
}
