// postal-sg's points as something to ask questions of: which points match a postal code
// pattern (./pattern.js), how many, where, and, for small results, the points themselves
// with their addresses.
//
// It reads the packed points file ($lib/data/postal-points.js, docs/adr/0005) and joins each
// point to its address from the per-sector address lists. That join is by position: a
// sector's address list is in the same order as that sector's points, because the build
// (scripts/data/postal-sg/build.js) sorts every point by code, then address, before writing
// both. The index checks that order where it relies on it: the points must be sorted by code
// (so each sector is one run), and a sector's list must have one address per point, each
// ending in that point's code. A list that doesn't line up is not used.
//
// It runs in the points worker, which hands it fetched files; tests hand it fixtures.

import { decodePostalPoints, formatPostal, sectorOf } from '$lib/data/postal-points.js';
import { matcher } from './pattern.js';

/** @typedef {import('./postal-protocol.js').PostalResult} PostalResult */
/** @typedef {import('./postal-protocol.js').PostalOverview} PostalOverview */
/** @typedef {import('./postal-protocol.js').PostalPoints} PostalPoints */
/** @typedef {import('./postal-protocol.js').Bounds} Bounds */

/**
 * The addresses of one sector's points, in the order of its points; may reject or resolve
 * null when there are none.
 * @typedef {(sector: string) => Promise<string[] | null>} LoadAddresses
 */

/**
 * @typedef {object} PostalIndex
 * @property {PostalOverview} overview
 * @property {() => PostalPoints} allPoints every point, without addresses
 * @property {(pattern: string) => Promise<PostalResult>} query
 */

/** Return the matching points (not just counts) for results up to this size... */
export const SELECTION_MAX_POINTS = 8000;
/** ...and add their addresses when they span at most this many sectors. */
export const ADDRESS_MAX_SECTORS = 4;
const COORD_DECIMALS = 6; // ~0.1 m; Float32 holds about this much anyway

/** @param {number} x */
const round = (x) => Math.round(x * 10 ** COORD_DECIMALS) / 10 ** COORD_DECIMALS;

/** "264B COMPASSVALE BOW THE CORIS SINGAPORE 542264" → "264B COMPASSVALE BOW THE CORIS" */
const ADDRESS_CODE = /\s+SINGAPORE\s+(\d{6})$/;

/**
 * @param {ArrayBuffer} pointsBuffer a packed points file
 * @param {LoadAddresses} loadAddresses
 * @param {{ selectionMaxPoints?: number, addressMaxSectors?: number }} [options]
 * @returns {PostalIndex}
 */
export function createPostalIndex(pointsBuffer, loadAddresses, options = {}) {
	const { selectionMaxPoints = SELECTION_MAX_POINTS, addressMaxSectors = ADDRESS_MAX_SECTORS } =
		options;
	const points = decodePostalPoints(pointsBuffer);
	const { count, codes, lons, lats } = points;

	/** @type {string[]} zero-padded postal code per point */
	const postals = new Array(count);
	/** @type {Map<string, { start: number, end: number }>} sector → its run of points */
	const sectorRuns = new Map();
	for (let i = 0; i < count; i++) {
		if (i > 0 && codes[i] < codes[i - 1]) {
			throw new Error(`Postal points are not sorted by code (index ${i})`);
		}
		postals[i] = formatPostal(codes[i]);
		const sector = sectorOf(codes[i]);
		const run = sectorRuns.get(sector);
		if (run) run.end = i + 1;
		else sectorRuns.set(sector, { start: i, end: i + 1 });
	}

	/** @type {Map<string, Promise<string[] | null>>} */
	const addressCache = new Map();

	/** @param {string} sector @returns {Promise<string[] | null>} */
	function sectorAddresses(sector) {
		let promise = addressCache.get(sector);
		if (!promise) {
			promise = Promise.resolve()
				.then(() => loadAddresses(sector))
				.then((list) => (list ? checkedAddresses(sector, list) : null))
				.catch((error) => {
					console.warn(`postal-index: no addresses for sector ${sector}:`, error.message);
					return null;
				})
				.then((list) => {
					if (!list) addressCache.delete(sector); // allow a retry later
					return list;
				});
			addressCache.set(sector, promise);
		}
		return promise;
	}

	/**
	 * The sector's list without "SINGAPORE <code>", or an error when it doesn't line up with
	 * the sector's points.
	 * @param {string} sector @param {string[]} list
	 */
	function checkedAddresses(sector, list) {
		const run = /** @type {{ start: number, end: number }} */ (sectorRuns.get(sector));
		if (list.length !== run.end - run.start) {
			throw new Error(`${list.length} addresses for ${run.end - run.start} points`);
		}
		return list.map((address, k) => {
			const suffix = address.match(ADDRESS_CODE);
			if (suffix && suffix[1] !== postals[run.start + k]) {
				throw new Error(`address ${k} is for ${suffix[1]}, its point is ${postals[run.start + k]}`);
			}
			return suffix ? address.slice(0, suffix.index) : address;
		});
	}

	/** @param {number[]} indices @returns {Promise<Map<number, string> | null>} */
	async function addressesFor(indices) {
		if (indices.length === 0) return null;
		const sectors = [...new Set(indices.map((i) => sectorOf(codes[i])))];
		if (sectors.length > addressMaxSectors) return null;
		const lists = await Promise.all(sectors.map(sectorAddresses));
		const bySector = new Map(sectors.map((s, k) => [s, lists[k]]));
		const result = new Map();
		for (const i of indices) {
			const sector = sectorOf(codes[i]);
			const run = /** @type {{ start: number }} */ (sectorRuns.get(sector));
			const address = bySector.get(sector)?.[i - run.start];
			if (address !== undefined) result.set(i, address);
		}
		return result;
	}

	/** @param {string} pattern */
	function filterIndices(pattern) {
		const match = matcher(pattern);
		const out = [];
		for (let i = 0; i < count; i++) if (match(postals[i])) out.push(i);
		return out;
	}

	/** Codes are sorted, so repeats sit next to each other. @param {number[]} indices */
	function countUnique(indices) {
		let unique = 0;
		for (let k = 0; k < indices.length; k++) {
			if (k === 0 || codes[indices[k]] !== codes[indices[k - 1]]) unique++;
		}
		return unique;
	}

	/** @param {number[]} indices @param {Map<number, string> | null} addresses @returns {PostalPoints} */
	function toFeatureCollection(indices, addresses) {
		const features = new Array(indices.length);
		for (let k = 0; k < indices.length; k++) {
			const i = indices[k];
			/** @type {import('./postal-protocol.js').PostalProperties} */
			const properties = { POSTAL: postals[i] };
			const address = addresses?.get(i);
			if (address !== undefined) properties.ADDRESS = address;
			features[k] = {
				type: 'Feature',
				properties,
				geometry: { type: 'Point', coordinates: [round(lons[i]), round(lats[i])] }
			};
		}
		return { type: 'FeatureCollection', features };
	}

	/** @param {number[]} indices @returns {Bounds | null} */
	function calculateBounds(indices) {
		if (indices.length === 0) return null;
		let minLng = Infinity,
			minLat = Infinity,
			maxLng = -Infinity,
			maxLat = -Infinity;
		for (const i of indices) {
			const lng = lons[i];
			const lat = lats[i];
			if (lng < minLng) minLng = lng;
			if (lng > maxLng) maxLng = lng;
			if (lat < minLat) minLat = lat;
			if (lat > maxLat) maxLat = lat;
		}
		return [
			[round(minLng), round(minLat)],
			[round(maxLng), round(maxLat)]
		];
	}

	const all = Array.from({ length: count }, (_, i) => i);

	return {
		overview: {
			count,
			unique: countUnique(all),
			sectors: sectorRuns.size,
			bounds: calculateBounds(all)
		},
		allPoints: () => toFeatureCollection(all, null),
		async query(pattern) {
			const indices = filterIndices(pattern);
			const small = indices.length <= selectionMaxPoints;
			const addresses = small ? await addressesFor(indices) : null;
			return {
				pattern,
				count: indices.length,
				unique: countUnique(indices),
				bounds: calculateBounds(indices),
				features: small ? toFeatureCollection(indices, addresses) : null
			};
		}
	};
}
