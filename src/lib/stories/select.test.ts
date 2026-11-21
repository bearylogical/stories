import { describe, expect, it } from 'vitest';
import { bySlug, slugFromPath } from './files';
import { findStory, selectStories } from './select';

const meta = (published: string, status: 'draft' | 'published', title = 'A Story') => ({
	title,
	published,
	summary: 'A summary.',
	image: '/covers/x.jpg',
	status
});

const sample = {
	'older-story': meta('2024-09-01', 'published'),
	'newer-story': meta('2026-11-15', 'published'),
	'work-in-progress': meta('2026-11-20', 'draft'),
	_example: meta('2026-11-15', 'draft')
};

const slugs = (list: { slug: string }[]) => list.map((s) => s.slug);

describe('selectStories', () => {
	it('leaves Drafts out when includeDrafts is off', () => {
		const list = selectStories(sample, { includeDrafts: false });
		expect(slugs(list.stories)).toEqual(['newer-story', 'older-story']);
	});

	it('includes Drafts, `_` samples among them, when includeDrafts is on', () => {
		const list = selectStories(sample, { includeDrafts: true });
		expect(slugs(list.stories)).toEqual([
			'work-in-progress',
			'_example',
			'newer-story',
			'older-story'
		]);
	});

	it('keeps only published Stories in `published`, whatever includeDrafts says', () => {
		for (const includeDrafts of [false, true]) {
			const list = selectStories(sample, { includeDrafts });
			expect(slugs(list.published)).toEqual(['newer-story', 'older-story']);
		}
	});

	it('lists every Story in `all`, Drafts included, whatever includeDrafts says', () => {
		const list = selectStories(sample, { includeDrafts: false });
		expect(list.all).toHaveLength(4);
	});

	it('orders newest first, then by Slug for Stories published the same day', () => {
		const list = selectStories(
			{
				b: meta('2026-01-01', 'published'),
				a: meta('2026-01-01', 'published'),
				c: meta('2026-06-01', 'published')
			},
			{ includeDrafts: false }
		);
		expect(slugs(list.stories)).toEqual(['c', 'a', 'b']);
	});

	it('adds the Slug to each Story’s checked frontmatter', () => {
		const [story] = selectStories(
			{ 'one-story': { ...meta('2026-11-15T00:00:00.000Z', 'published'), title: '  Hi  ' } },
			{ includeDrafts: false }
		).stories;
		expect(story).toMatchObject({ slug: 'one-story', title: 'Hi', published: '2026-11-15' });
	});

	it('rejects a published `_` sample Story', () => {
		expect(() =>
			selectStories({ _sample: meta('2026-11-15', 'published') }, { includeDrafts: false })
		).toThrow(/samples and must stay "draft"/);
	});

	it('fails on any invalid Story rather than skipping it', () => {
		expect(() =>
			selectStories({ ...sample, broken: { title: 'No date' } }, { includeDrafts: false })
		).toThrow(/src\/stories\/broken\/index\.svx/);
	});

	it('is empty when there are no Stories', () => {
		expect(selectStories({}, { includeDrafts: true })).toEqual({
			all: [],
			stories: [],
			published: []
		});
	});
});

describe('findStory', () => {
	const { stories } = selectStories(sample, { includeDrafts: false });

	it('finds a Story this build serves', () => {
		expect(findStory(stories, 'older-story')?.published).toBe('2024-09-01');
	});

	it('finds nothing for an unknown Slug', () => {
		expect(findStory(stories, 'no-such-story')).toBeUndefined();
	});

	it('finds nothing for a Draft when Drafts are left out', () => {
		expect(findStory(stories, 'work-in-progress')).toBeUndefined();
	});

	it('finds a Draft when Drafts are included', () => {
		const withDrafts = selectStories(sample, { includeDrafts: true }).stories;
		expect(findStory(withDrafts, 'work-in-progress')?.status).toBe('draft');
	});
});

describe('Story files', () => {
	it('takes the Slug from the Story’s folder name', () => {
		expect(slugFromPath('/src/stories/postal-sg/index.svx')).toBe('postal-sg');
		expect(slugFromPath('/src/stories/_example/index.svx')).toBe('_example');
	});

	it('rejects paths outside the Story layout', () => {
		expect(() => slugFromPath('/src/stories/postal-sg/notes.svx')).toThrow(/Not a Story file/);
		expect(() => slugFromPath('/src/routes/postal-sg/index.svx')).toThrow(/Not a Story file/);
	});

	it('re-keys a glob result by Slug', () => {
		expect(bySlug({ '/src/stories/a/index.svx': 1, '/src/stories/b/index.svx': 2 })).toEqual({
			a: 1,
			b: 2
		});
	});
});
