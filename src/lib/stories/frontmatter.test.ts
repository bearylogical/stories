import { readFile } from 'node:fs/promises';
import { compile } from 'mdsvex';
import { describe, expect, it } from 'vitest';
import {
	DEFAULT_IMAGE,
	draftFrontmatter,
	frontmatterBlock,
	isSlug,
	parseFrontmatter,
	slugify
} from './frontmatter';

/** Runs `index.svx` source through mdsvex and returns its frontmatter as the Story list sees it. */
async function frontmatterOf(source: string): Promise<unknown> {
	const result = await compile(source);
	const fm = (result?.data as { fm?: unknown } | undefined)?.fm;
	// The compiled Story exports `metadata` as JSON, so YAML dates reach the reader as ISO strings.
	return JSON.parse(JSON.stringify(fm ?? null));
}

describe('isSlug', () => {
	it.each([
		['postal-sg', true, true],
		['hdb-heights-2', true, true],
		['2024', true, true],
		['_example', false, true],
		['a--b', false, false],
		['a-', false, false],
		['-a', false, false],
		['A', false, false],
		['', false, false],
		['_', false, false],
		['__a', false, false],
		['a_b', false, false],
		['a b', false, false]
	])('%j: Slug %s, with samples %s', (value, real, withSamples) => {
		expect(isSlug(value)).toBe(real);
		expect(isSlug(value, { samples: true })).toBe(withSamples);
	});

	it('rejects non-strings', () => {
		expect(isSlug(undefined)).toBe(false);
		expect(isSlug(42)).toBe(false);
	});
});

describe('slugify', () => {
	it.each([
		['Topography of Singapore Postal Codes', 'topography-of-singapore-postal-codes'],
		['Where Singapore’s trees grow', 'where-singapores-trees-grow'],
		["HDB's Heights", 'hdbs-heights'],
		['Café  Crème — 2024!', 'cafe-creme-2024'],
		['  --Leading and trailing--  ', 'leading-and-trailing'],
		['新加坡', ''],
		['a'.repeat(59) + ' bcd', 'a'.repeat(59)]
	])('%j → %j', (title, slug) => {
		expect(slugify(title)).toBe(slug);
	});

	it('gives a Slug for any title with a Latin letter or digit', () => {
		for (const title of ['Postal codes', 'Ünïcödé', '1 - 2 - 3', 'x'.repeat(100)]) {
			expect(isSlug(slugify(title))).toBe(true);
		}
	});
});

describe('draft frontmatter', () => {
	const fields = {
		title: ' A "quoted": title ',
		summary: 'One line.\nTwo: lines.',
		published: '2026-11-21'
	};

	it('takes the defaults for everything not asked for', () => {
		expect(draftFrontmatter(fields)).toEqual({
			title: 'A "quoted": title',
			published: '2026-11-21',
			summary: 'One line.\nTwo: lines.',
			image: DEFAULT_IMAGE,
			status: 'draft'
		});
	});

	it('round-trips through mdsvex and parseFrontmatter', async () => {
		const meta = draftFrontmatter(fields);
		const fm = await frontmatterOf(`${frontmatterBlock(meta)}\nBody.\n`);
		expect(parseFrontmatter('new-story', fm)).toEqual(meta);
	});

	it('round-trips optional keys too', async () => {
		const meta = {
			...draftFrontmatter(fields),
			status: 'published' as const,
			updated: '2026-12-01',
			sources: [{ label: 'OneMap: "postal"', href: 'https://www.onemap.gov.sg/' }]
		};
		const fm = await frontmatterOf(`${frontmatterBlock(meta)}\nBody.\n`);
		expect(parseFrontmatter('new-story', fm)).toEqual(meta);
	});

	it('a blank title or summary fails the reader', () => {
		const meta = draftFrontmatter({ ...fields, title: '  ', summary: '' });
		expect(() => parseFrontmatter('new-story', meta)).toThrow(
			/"title" is required[\s\S]*"summary" is required/
		);
	});
});

describe('parseFrontmatter', () => {
	const valid = draftFrontmatter({ title: 'T', summary: 'S', published: '2026-11-21' });

	it('accepts sample folders, but only as Drafts', () => {
		expect(parseFrontmatter('_example', valid).status).toBe('draft');
		expect(() => parseFrontmatter('_example', { ...valid, status: 'published' })).toThrow(
			/samples and must stay "draft"/
		);
	});

	it.each(['a--b', 'a-', 'A', '-a'])('rejects the folder name %j', (slug) => {
		expect(() => parseFrontmatter(slug, valid)).toThrow(/not a valid Slug/);
	});

	it('accepts the Stories in src/stories/', async () => {
		for (const slug of ['_example', 'postal-sg']) {
			const source = await readFile(`src/stories/${slug}/index.svx`, 'utf8');
			const fm = await frontmatterOf(source);
			expect(() => parseFrontmatter(slug, fm)).not.toThrow();
		}
	});
});
