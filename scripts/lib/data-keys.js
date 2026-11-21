// Names for a Story's Story Data files, shared by the scripts.

/**
 * `district-counts.csv` → `districtCounts`, the file's key in the Story's `urls`.
 * A stem starting with a digit gets a leading `_` so the key is a valid identifier.
 *
 * @param {string} name A file name with an extension.
 * @returns {string}
 */
export function keyOf(name) {
	const stem = name.slice(0, name.lastIndexOf('.'));
	return stem.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase()).replace(/^(\d)/, '_$1');
}
