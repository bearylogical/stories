/**
 * Where Stories live on disk: `src/stories/<slug>/index.svx` (docs/adr/0004).
 *
 * Vite needs each `import.meta.glob` pattern written out literally, so the two globs
 * (frontmatter in `./index.ts`, components in `./component.ts`) both spell out
 * `STORY_FILES`; each passes its result through `bySlug`, which rejects any path that
 * doesn't match, so a pattern that drifts fails loudly instead of losing Stories.
 */
export const STORY_FILES = '/src/stories/*/index.svx';

const STORY_PATH = /^\/src\/stories\/([^/]+)\/index\.svx$/;

/** The Slug of the Story at this glob path: its folder name. */
export function slugFromPath(path: string): string {
	const match = STORY_PATH.exec(path);
	if (!match) throw new Error(`Not a Story file: ${path} (expected ${STORY_FILES})`);
	return match[1];
}

/** An `import.meta.glob` result re-keyed from file path to Slug. */
export function bySlug<T>(modules: Record<string, T>): Record<string, T> {
	return Object.fromEntries(
		Object.entries(modules).map(([path, module]) => [slugFromPath(path), module])
	);
}
