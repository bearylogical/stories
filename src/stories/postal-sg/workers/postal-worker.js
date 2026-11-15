// postal-worker.js
//
// Loads postal-sg's packed postal points (src/lib/data/postal-points.js,
// docs/adr/0005) and filters them by pattern across the whole island.
// Address text is fetched per sector, only for small result sets (zoomed into
// buildings, or a specific code in the Explorer).
//
// Messages in:  LOAD_DATA { url }, FILTER { pattern, maxResults }
// Messages out: LOAD_COMPLETE, FILTER_COMPLETE, ERROR. Features are GeoJSON
// Points with properties { POSTAL, ADDRESS? }.

import { decodePostalPoints, formatPostal, sectorOf } from '$lib/data/postal-points.js';
import { urls } from '$lib/data/postal-sg.js';

/** Fetch addresses only when a result has at most this many points... */
const ADDRESS_MAX_POINTS = 2000;
/** ...spread over at most this many sectors. */
const ADDRESS_MAX_SECTORS = 4;
const COORD_DECIMALS = 6; // ~0.1 m; Float32 holds about this much anyway

/** @typedef {{ count: number, codes: Uint32Array, lons: Float32Array, lats: Float32Array }} Points */
/** @type {Points} set by LOAD_DATA before any FILTER */
let points = /** @type {any} */ (null);
/** @type {string[]} zero-padded postal code per point */
let postals = [];
/** @type {Map<string, number>} sector → index of its first point */
const sectorStart = new Map();
/** @type {Map<string, Promise<string[] | null>>} */
const addressCache = new Map();

/** @param {number} x */
const round = (x) => Math.round(x * 10 ** COORD_DECIMALS) / 10 ** COORD_DECIMALS;

/** @param {string} url */
async function loadPostalCodes(url) {
	try {
		const response = await fetch(url);
		if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
		points = decodePostalPoints(await response.arrayBuffer());
		postals = new Array(points.count);
		for (let i = 0; i < points.count; i++) {
			postals[i] = formatPostal(points.codes[i]);
			const sector = postals[i].slice(0, 2);
			if (!sectorStart.has(sector)) sectorStart.set(sector, i);
		}
		const all = Array.from({ length: points.count }, (_, i) => i);
		return {
			success: true,
			count: points.count,
			features: toFeatureCollection(all, null),
			simplified: [],
			bounds: calculateBounds(all)
		};
	} catch (error) {
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

/** Addresses for one sector, in the same order as that sector's points. */
/** @param {string} sector @returns {Promise<string[] | null>} */
function loadSectorAddresses(sector) {
	if (!addressCache.has(sector)) {
		const promise = fetch(urls.addresses(sector))
			.then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
			.catch((error) => {
				console.warn(`postal-worker: no addresses for sector ${sector}:`, error.message);
				addressCache.delete(sector); // allow a retry later
				return null;
			});
		addressCache.set(sector, promise);
	}
	return /** @type {Promise<string[] | null>} */ (addressCache.get(sector));
}

/** @param {number[]} indices @returns {Promise<Map<number, string> | null>} */
async function addressesFor(indices) {
	if (indices.length === 0 || indices.length > ADDRESS_MAX_POINTS) return null;
	const sectors = [...new Set(indices.map((i) => sectorOf(points.codes[i])))];
	if (sectors.length > ADDRESS_MAX_SECTORS) return null;
	const lists = await Promise.all(sectors.map(loadSectorAddresses));
	const bySector = new Map(sectors.map((s, k) => [s, lists[k]]));
	const result = new Map();
	for (const i of indices) {
		const sector = postals[i].slice(0, 2);
		const list = bySector.get(sector);
		const address = list?.[i - (sectorStart.get(sector) ?? 0)];
		if (address !== undefined) result.set(i, address);
	}
	return result;
}

// Pattern matching: "*" wildcards, a single "[a-b]" digit range, or an exact code.
/** @param {string} pattern @returns {(postal: string) => boolean} */
function createFilterFunction(pattern) {
	if (!pattern || pattern === '*') return () => true;

	const rangeMatch = pattern.match(/^(.+)\[(\d)-(\d)\](.*)$/);
	if (rangeMatch) {
		const [, prefix, start, end, suffix] = rangeMatch;
		const regex = new RegExp(`^${escapeRegex(prefix)}[${start}-${end}]${escapeRegex(suffix)}$`);
		return (postal) => regex.test(postal);
	}

	if (pattern.includes('*')) {
		const regex = new RegExp(
			`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`
		);
		return (postal) => regex.test(postal);
	}

	return (postal) => postal === pattern;
}

/** @param {string} string */
function escapeRegex(string) {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** @param {string} pattern @param {number} [maxResults] @returns {number[]} indices of matching points */
function filterIndices(pattern, maxResults = -1) {
	if (!points || maxResults === 0) return [];
	const limit = maxResults < 0 ? points.count : maxResults;
	const match = createFilterFunction(pattern);
	const out = [];
	for (let i = 0; i < points.count && out.length < limit; i++) {
		if (match(postals[i])) out.push(i);
	}
	return out;
}

/** @param {number[]} indices @param {Map<number, string> | null} addresses */
function toFeatureCollection(indices, addresses) {
	const features = new Array(indices.length);
	for (let k = 0; k < indices.length; k++) {
		const i = indices[k];
		/** @type {{ POSTAL: string, ADDRESS?: string }} */
		const properties = { POSTAL: postals[i] };
		const address = addresses?.get(i);
		if (address !== undefined) properties.ADDRESS = address;
		features[k] = {
			type: 'Feature',
			properties,
			geometry: { type: 'Point', coordinates: [round(points.lons[i]), round(points.lats[i])] }
		};
	}
	return { type: 'FeatureCollection', features };
}

/** @param {number[]} indices */
function calculateBounds(indices) {
	if (indices.length === 0) return null;
	let minLng = Infinity,
		minLat = Infinity,
		maxLng = -Infinity,
		maxLat = -Infinity;
	for (const i of indices) {
		const lng = points.lons[i];
		const lat = points.lats[i];
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

self.onmessage = async function (e) {
	const { type, data } = e.data;

	switch (type) {
		case 'LOAD_DATA': {
			const result = await loadPostalCodes(data?.url ?? urls.points);
			self.postMessage({ type: 'LOAD_COMPLETE', data: result });
			break;
		}

		case 'FILTER': {
			const { pattern, maxResults } = data;
			const indices = filterIndices(pattern, maxResults);
			const addresses = await addressesFor(indices);
			self.postMessage({
				type: 'FILTER_COMPLETE',
				data: {
					features: toFeatureCollection(indices, addresses),
					count: indices.length,
					bounds: calculateBounds(indices),
					pattern,
					simplified: []
				}
			});
			break;
		}

		default:
			self.postMessage({ type: 'ERROR', data: { message: 'Unknown message type' } });
	}
};
