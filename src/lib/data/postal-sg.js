// Story Data for postal-sg (docs/adr/0003).
//
// This is the one place the version numbers live. The build script
// (scripts/data/postal-sg/build.js) names its output from them, and the page
// loads the same names. To change a file: bump its version here, run
// `pnpm data:publish postal-sg`, then merge. Published files never change.
//
// Relative import (not $lib) so the Node build script and the worker can load it.
import { storyDataUrls, versionedName } from './story-data.js';

export { DATA_HOST } from './story-data.js';
export const SLUG = 'postal-sg';

export const VERSIONS = {
	points: 2,
	addresses: 1,
	districts: 1
};

/** File names (relative to `<DATA_HOST>/<SLUG>/`). */
export const files = {
	points: versionedName('points', VERSIONS.points, 'bin'),
	/** @param {string} sector two digits, e.g. "54" */
	addresses: (sector) => versionedName(`addresses-${sector}`, VERSIONS.addresses, 'json'),
	districts: versionedName('districts', VERSIONS.districts, 'geojson')
};

export const urls = storyDataUrls(SLUG, files);
