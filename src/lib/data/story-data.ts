/**
 * Where a Story's Story Data is published: `<DATA_HOST>/<slug>/<name>.v<N>.<ext>` (docs/adr/0003).
 * `VITE_DATA_HOST` overrides the host, e.g. to test files before `pnpm data:publish`.
 */
export const DATA_HOST: string = import.meta.env.VITE_DATA_HOST || 'https://data.bearylogical.net';

/** The URL of one published Story Data file, e.g. `storyDataUrl('my-story', 'counts.v1.csv')`. */
export function storyDataUrl(slug: string, file: string): string {
	return `${DATA_HOST}/${slug}/${file}`;
}
