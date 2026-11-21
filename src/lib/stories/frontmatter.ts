/**
 * A Story's Slug and frontmatter rules: the reader's checks (`parseFrontmatter`) and the
 * new-story wizard's defaults (`draftFrontmatter`) come from the same module, so a new Draft
 * always passes the reader. The rules live in `./story-rules.js` so the Node scripts in
 * `scripts/` can import them too; import them from here inside the site.
 */
export {
	DEFAULT_IMAGE,
	SAMPLE_PREFIX,
	SLUG_RULE,
	draftFrontmatter,
	frontmatterBlock,
	isSampleSlug,
	isSlug,
	parseFrontmatter,
	slugify
} from './story-rules.js';
