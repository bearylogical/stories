import type { StoryMeta, StorySource } from './types';

/** Lower-case words joined by hyphens; a leading `_` marks an internal sample Story. */
const SLUG = /^_?[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}/;

/**
 * Checks one Story's frontmatter and returns it normalised.
 * Throws one error listing every problem, so a bad Story fails the build (not the reader's page).
 */
export function parseFrontmatter(slug: string, data: unknown): StoryMeta {
	const problems: string[] = [];
	const fm = (data ?? {}) as Record<string, unknown>;

	if (!SLUG.test(slug)) {
		problems.push(`folder name "${slug}" is not a valid Slug (lower-case words joined by "-")`);
	}

	const text = (key: string, required: boolean): string | undefined => {
		const value = fm[key];
		if (value === undefined || value === null || value === '') {
			if (required) problems.push(`"${key}" is required`);
			return undefined;
		}
		if (typeof value !== 'string') {
			problems.push(`"${key}" must be text`);
			return undefined;
		}
		return value.trim();
	};

	// YAML dates arrive as ISO strings (mdsvex serialises frontmatter to JSON); keep the day only.
	const date = (key: string, required: boolean): string | undefined => {
		const value = text(key, required);
		if (value === undefined) return undefined;
		if (!DATE.test(value) || Number.isNaN(Date.parse(value.slice(0, 10)))) {
			problems.push(`"${key}" must be a date like 2026-11-15 (got "${value}")`);
			return undefined;
		}
		return value.slice(0, 10);
	};

	const title = text('title', true);
	const published = date('published', true);
	const updated = date('updated', false);
	const summary = text('summary', true);
	const image = text('image', true);

	const status = fm.status;
	if (status !== 'draft' && status !== 'published') {
		problems.push(`"status" must be "draft" or "published" (got ${JSON.stringify(status)})`);
	} else if (status === 'published' && slug.startsWith('_')) {
		problems.push(`Slugs starting with "_" are samples and must stay "draft"`);
	}

	let sources: StorySource[] | undefined;
	if (fm.sources !== undefined) {
		if (!Array.isArray(fm.sources)) {
			problems.push(`"sources" must be a list of { label, href }`);
		} else {
			sources = [];
			fm.sources.forEach((source, i) => {
				const s = (source ?? {}) as Record<string, unknown>;
				if (typeof s.label !== 'string' || typeof s.href !== 'string') {
					problems.push(`"sources[${i}]" needs text "label" and "href"`);
				} else {
					sources!.push({ label: s.label, href: s.href });
				}
			});
		}
	}

	if (published && updated && updated < published) {
		problems.push(`"updated" (${updated}) is before "published" (${published})`);
	}

	const known = new Set(['title', 'published', 'updated', 'summary', 'image', 'status', 'sources']);
	for (const key of Object.keys(fm)) {
		if (!known.has(key)) problems.push(`unknown key "${key}"`);
	}

	if (problems.length > 0) {
		throw new Error(
			`Invalid frontmatter in src/stories/${slug}/index.svx:\n  - ${problems.join('\n  - ')}`
		);
	}

	return {
		title: title!,
		published: published!,
		summary: summary!,
		image: image!,
		status: status as StoryMeta['status'],
		...(updated && { updated }),
		...(sources && { sources })
	};
}
