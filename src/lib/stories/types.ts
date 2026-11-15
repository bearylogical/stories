/** A Story's lifecycle: a Draft is visible to its author and reviewers only. */
export type StoryStatus = 'draft' | 'published';

/** One upstream source credited at the end of a Story. */
export interface StorySource {
	label: string;
	href: string;
}

/** A Story's frontmatter, checked by `parseFrontmatter`. Dates are `YYYY-MM-DD`. */
export interface StoryMeta {
	title: string;
	published: string;
	summary: string;
	/** Path or absolute URL of the link-preview image. */
	image: string;
	status: StoryStatus;
	updated?: string;
	sources?: StorySource[];
}

/** A Story in the Story list: its frontmatter plus the Slug from its folder name. */
export interface Story extends StoryMeta {
	slug: string;
}
