/** Publication-wide settings shared by every Story and the Front Page. */
export const site = {
	name: 'Bearylogical Stories',
	/** The one-line introduction on the Front Page; also its link-preview description. */
	description: 'Visual stories that each walk you through one dataset as you scroll.',
	shortName: 'Bearylogical',
	url: 'https://stories.bearylogical.net',
	defaultImage: '/web_thumb.png',
	locale: 'en_SG'
} as const;

/** Absolute URL on the Publication for a path such as `/postal-sg/`. */
export function absoluteUrl(path: string): string {
	return new URL(path, site.url).href;
}
