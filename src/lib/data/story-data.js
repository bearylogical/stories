// Story Data addresses (docs/adr/0003): every published file lives at
//
//   <DATA_HOST>/<slug>/<name>.v<N>.<ext>
//
// and never changes. This module is the one place that knows the host and the
// `<name>.v<N>.<ext>` grammar, for building names and for parsing them back.
//
// Plain JS with JSDoc so that the browser, the postal-sg worker and the Node
// scripts in scripts/ (run with `node`, no TS loader) can all import it.

/**
 * The host Story Data is served from. `VITE_DATA_HOST` overrides it, e.g. to
 * test files before `pnpm data:publish`. Written so Vite replaces it statically
 * (also inside workers) and so Node, where `import.meta.env` is undefined, can
 * import this file.
 * @type {string}
 */
export const DATA_HOST =
	(import.meta.env && import.meta.env.VITE_DATA_HOST) || 'https://data.bearylogical.net';

/** `<name>`: lower-case letters, digits and `-`, starting with a letter or digit. */
const NAME = /^[a-z0-9][a-z0-9-]*$/;
/** `<ext>`: lower-case letters and digits, without the dot. */
const EXT = /^[a-z0-9]+$/;
/** `<name>.v<N>.<ext>`, where N is a whole number from 1 with no leading zeros. */
const VERSIONED_NAME = /^([a-z0-9][a-z0-9-]*)\.v([1-9]\d*)\.([a-z0-9]+)$/;

/**
 * @typedef {object} VersionedName
 * @property {string} name e.g. `addresses-54`
 * @property {number} version e.g. `1`
 * @property {string} ext e.g. `json` (no dot)
 */

/**
 * The published file name for one version of a Story Data file.
 * `versionedName('counts', 2, 'csv')` → `counts.v2.csv`. Throws if a part is not allowed.
 * @param {string} name
 * @param {number} version
 * @param {string} ext without the dot
 * @returns {string}
 */
export function versionedName(name, version, ext) {
	if (!NAME.test(name)) throw new Error(`Not a Story Data name (a-z, 0-9, "-"): ${name}`);
	if (!Number.isInteger(version) || version < 1)
		throw new Error(`Not a Story Data version (a whole number from 1): ${version}`);
	if (!EXT.test(ext)) throw new Error(`Not a Story Data extension (a-z, 0-9, no dot): ${ext}`);
	return `${name}.v${version}.${ext}`;
}

/**
 * The parts of a published file name, or `null` if it is not `<name>.v<N>.<ext>`.
 * `parseVersionedName('counts.v2.csv')` → `{ name: 'counts', version: 2, ext: 'csv' }`.
 * @param {string} file
 * @returns {VersionedName | null}
 */
export function parseVersionedName(file) {
	const match = VERSIONED_NAME.exec(file);
	if (!match) return null;
	return { name: match[1], version: Number(match[2]), ext: match[3] };
}

/**
 * Whether a file name is a publishable `<name>.v<N>.<ext>`.
 * @param {string} file
 * @returns {boolean}
 */
export function isVersionedName(file) {
	return VERSIONED_NAME.test(file);
}

/**
 * Where a published file sits in the bucket and under the host: `<slug>/<file>`.
 * @param {string} slug
 * @param {string} file a versioned name
 * @returns {string}
 */
export function storyDataKey(slug, file) {
	return `${slug}/${file}`;
}

/**
 * The URL of one published Story Data file, e.g. `storyDataUrl('my-story', 'counts.v1.csv')`.
 * @param {string} slug
 * @param {string} file a versioned name
 * @returns {string}
 */
export function storyDataUrl(slug, file) {
	return `${DATA_HOST}/${storyDataKey(slug, file)}`;
}

/**
 * A Story's `urls` from its `files`: each file name becomes its URL, and each
 * function that makes a file name (e.g. one file per sector) becomes a function
 * that makes its URL.
 *
 * ```js
 * const files = { counts: versionedName('counts', 1, 'csv'), sector: (s) => versionedName(`sector-${s}`, 1, 'json') };
 * const urls = storyDataUrls('my-story', files); // urls.counts, urls.sector('54')
 * ```
 * @template {Record<string, string | ((...args: any[]) => string)>} F
 * @param {string} slug
 * @param {F} files
 * @returns {{ [K in keyof F]: F[K] extends (...args: infer A) => string ? (...args: A) => string : string }}
 */
export function storyDataUrls(slug, files) {
	/** @type {Record<string, unknown>} */
	const urls = {};
	for (const [key, file] of Object.entries(files)) {
		urls[key] =
			typeof file === 'function'
				? (/** @type {any[]} */ ...args) => storyDataUrl(slug, file(...args))
				: storyDataUrl(slug, file);
	}
	return /** @type {any} */ (urls);
}
