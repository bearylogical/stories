// The rules for a Story's Slug and frontmatter, in one place.
//
// Plain JavaScript (with JSDoc types) so both the site (through `./frontmatter.ts`) and the
// Node scripts in `scripts/` (`new-story`, `data:publish`) can import it without a TS loader.
// Keep it free of `$lib` imports and of anything that needs Vite.

/** @typedef {import('./types').StoryMeta} StoryMeta */
/** @typedef {import('./types').StorySource} StorySource */

/** Lower-case words joined by single hyphens, e.g. `postal-sg`. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}/;

/** A leading `_` marks a sample Story (e.g. `_example`): it is never published. */
export const SAMPLE_PREFIX = '_';

/** The link-preview image a new Draft starts with, until its author makes a cover. */
export const DEFAULT_IMAGE = '/covers/default.jpg';

/** What `isSlug` says about a bad Slug. */
export const SLUG_RULE = 'lower-case letters and digits joined by single "-", e.g. hdb-heights';

/**
 * Whether `value` is a Slug: lower-case words joined by single hyphens.
 *
 * A sample Slug (`_example`) is only accepted with `{ samples: true }`. Only the Story list
 * allows samples, because a sample's folder lives in `src/stories/` but never becomes a
 * published URL; the new-story wizard and `data:publish` deal in real Slugs only.
 *
 * @param {unknown} value
 * @param {{ samples?: boolean }} [options]
 * @returns {value is string}
 */
export function isSlug(value, { samples = false } = {}) {
	if (typeof value !== 'string') return false;
	const name = samples && value.startsWith(SAMPLE_PREFIX) ? value.slice(1) : value;
	return SLUG.test(name);
}

/** @param {string} slug */
export const isSampleSlug = (slug) => slug.startsWith(SAMPLE_PREFIX);

/**
 * Suggests a Slug for a title: `Where Singapore’s trees grow` → `where-singapores-trees-grow`.
 * The result may be empty (a title with no Latin letters or digits); check it with `isSlug`.
 *
 * @param {string} title
 * @returns {string}
 */
export function slugify(title) {
	return title
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/['’]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60)
		.replace(/-+$/, '');
}

/**
 * The frontmatter of a new Draft. Everything not asked for takes its default, so the result
 * always passes `parseFrontmatter` when `title` and `summary` are non-blank.
 *
 * @param {{ title: string, summary: string, published: string }} fields
 *   `published` is a `YYYY-MM-DD` day, normally today.
 * @returns {StoryMeta}
 */
export function draftFrontmatter({ title, summary, published }) {
	return {
		title: title.trim(),
		published,
		summary: summary.trim(),
		image: DEFAULT_IMAGE,
		status: 'draft'
	};
}

/**
 * Writes frontmatter as the YAML block at the top of `index.svx`, keys in the reader's order.
 * Text is written as JSON strings (valid YAML); dates are written bare, like hand-written Stories.
 *
 * @param {StoryMeta} meta
 * @returns {string}
 */
export function frontmatterBlock(meta) {
	/** @type {string[]} */
	const lines = [
		`title: ${JSON.stringify(meta.title)}`,
		`published: ${meta.published}`,
		...(meta.updated ? [`updated: ${meta.updated}`] : []),
		`summary: ${JSON.stringify(meta.summary)}`,
		`image: ${JSON.stringify(meta.image)}`,
		`status: ${meta.status}`
	];
	if (meta.sources?.length) {
		lines.push('sources:');
		for (const s of meta.sources) {
			lines.push(`  - label: ${JSON.stringify(s.label)}`, `    href: ${JSON.stringify(s.href)}`);
		}
	}
	return `---\n${lines.join('\n')}\n---\n`;
}

/**
 * Checks one Story's frontmatter and returns it normalised.
 * Throws one error listing every problem, so a bad Story fails the build (not the reader's page).
 *
 * @param {string} slug The Story's folder name; sample Slugs (`_example`) are allowed.
 * @param {unknown} data The frontmatter as mdsvex gives it (YAML dates arrive as ISO strings).
 * @returns {StoryMeta}
 */
export function parseFrontmatter(slug, data) {
	/** @type {string[]} */
	const problems = [];
	const fm = /** @type {Record<string, unknown>} */ (data ?? {});

	if (!isSlug(slug, { samples: true })) {
		problems.push(`folder name "${slug}" is not a valid Slug (${SLUG_RULE})`);
	}

	/** @param {string} key @param {boolean} required @returns {string | undefined} */
	const text = (key, required) => {
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
	/** @param {string} key @param {boolean} required @returns {string | undefined} */
	const date = (key, required) => {
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
	} else if (status === 'published' && isSampleSlug(slug)) {
		problems.push(`Slugs starting with "${SAMPLE_PREFIX}" are samples and must stay "draft"`);
	}

	/** @type {StorySource[] | undefined} */
	let sources;
	if (fm.sources !== undefined) {
		if (!Array.isArray(fm.sources)) {
			problems.push(`"sources" must be a list of { label, href }`);
		} else {
			/** @type {StorySource[]} */
			const list = [];
			fm.sources.forEach((source, i) => {
				const s = /** @type {Record<string, unknown>} */ (source ?? {});
				if (typeof s.label !== 'string' || typeof s.href !== 'string') {
					problems.push(`"sources[${i}]" needs text "label" and "href"`);
				} else {
					list.push({ label: s.label, href: s.href });
				}
			});
			sources = list;
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
		title: /** @type {string} */ (title),
		published: /** @type {string} */ (published),
		summary: /** @type {string} */ (summary),
		image: /** @type {string} */ (image),
		status: /** @type {StoryMeta['status']} */ (status),
		...(updated && { updated }),
		...(sources && { sources })
	};
}
