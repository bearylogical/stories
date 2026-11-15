/** Publication-wide settings shared by every Story and the Front Page. */
export const site = {
	/** The Publication's name: the wordmark, and the suffix on every Story's title. */
	name: 'stories',
	/** Who publishes it; shown small beside the name, never in its place. */
	publisher: 'bearylogical',
	/** Name and publisher together, where the name alone is too bare (tab, feed, previews). */
	fullName: 'stories · bearylogical',
	/** The one-line introduction on the Front Page; also its link-preview description. */
	description: 'Visual stories that each walk you through one dataset as you scroll.',
	url: 'https://stories.bearylogical.net',
	defaultImage: '/covers/default.jpg',
	locale: 'en_SG'
} as const;

/** Absolute URL on the Publication for a path such as `/postal-sg/`. */
export function absoluteUrl(path: string): string {
	return new URL(path, site.url).href;
}
