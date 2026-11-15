// Story Data for postal-sg (docs/adr/0003).
//
// This is the one place the version numbers live. The build script
// (scripts/data/postal-sg/build.js) names its output from them, and the page
// loads the same names. To change a file: bump its version here, run
// `pnpm data:publish postal-sg`, then merge. Published files never change.

// VITE_DATA_HOST overrides the host, e.g. to test unpublished files locally.
// Written so Vite can replace it statically (also inside the worker) and so the
// Node build script, where import.meta.env is undefined, can import this file.
export const DATA_HOST =
	(import.meta.env && import.meta.env.VITE_DATA_HOST) || 'https://data.bearylogical.net';
export const SLUG = 'postal-sg';

export const VERSIONS = {
	points: 2,
	addresses: 1,
	districts: 1
};

/** File names (relative to `<DATA_HOST>/<SLUG>/`). */
export const files = {
	points: `points.v${VERSIONS.points}.bin`,
	/** @param {string} sector two digits, e.g. "54" */
	addresses: (sector) => `addresses-${sector}.v${VERSIONS.addresses}.json`,
	districts: `districts.v${VERSIONS.districts}.geojson`
};

const base = `${DATA_HOST}/${SLUG}`;

export const urls = {
	points: `${base}/${files.points}`,
	/** @param {string} sector */
	addresses: (sector) => `${base}/${files.addresses(sector)}`,
	districts: `${base}/${files.districts}`
};
