/**
 * The Story list: every Story in `src/stories/<slug>/index.svx`, newest first.
 * The Front Page, RSS and the `[slug]` route's `entries()` all read it (docs/adr/0004).
 *
 * This module only wires the real Stories and the build's `includeDrafts` into
 * `selectStories` (`./select.ts`), which holds the rules and is what the tests exercise.
 *
 * Server-side only (server loads and endpoints, run while prerendering): reading each Story's
 * frontmatter imports the Story itself, so importing this in the browser would ship every
 * Story to every page. The browser loads one Story's component through `./component.ts`.
 */
import { bySlug } from './files';
import { findStory, selectStories } from './select';
import type { Story } from './types';

export type { Story, StoryMeta, StorySource, StoryStatus } from './types';

/**
 * Whether Drafts are part of this build: always in `vite dev`, and in a build only with
 * `PUBLIC_INCLUDE_DRAFTS=true` (`pnpm build:drafts`, PR previews). Set in `vite.config.ts`.
 */
export const includeDrafts: boolean = __INCLUDE_DRAFTS__;

// Frontmatter only; mdsvex exports it as `metadata`. The pattern is `STORY_FILES` (./files.ts),
// written out because Vite requires a literal. Validated in `selectStories`, so a bad Story
// fails `vite build` while prerendering instead of breaking a reader's page.
const frontmatter = bySlug(
	import.meta.glob<Record<string, unknown>>('/src/stories/*/index.svx', {
		eager: true,
		import: 'metadata'
	})
);

const list = selectStories(frontmatter, { includeDrafts });

/** Every Story in the repo, Drafts included, newest first. */
export const allStories: Story[] = list.all;

/** The Stories this build serves: published ones, plus Drafts when `includeDrafts` is on. */
export const stories: Story[] = list.stories;

/** Published Stories only, whatever the build (for RSS). */
export const publishedStories: Story[] = list.published;

/** The Story at this Slug, if this build serves it. */
export function getStory(slug: string): Story | undefined {
	return findStory(stories, slug);
}
