// postal-worker.js
//
// Loads postal-sg's packed postal points (src/lib/data/postal-points.js,
// docs/adr/0005), hands the map every point once, and answers pattern queries
// (../pattern.js) with counts, bounds and, for small results, the points
// themselves with their addresses. The map filters its own copy of the points
// with the same pattern, so a query never re-sends the whole island.
//
// Messages in:  LOAD_DATA { url }, FILTER { pattern }
// Messages out: LOAD_COMPLETE, FILTER_COMPLETE, ERROR.

import { decodePostalPoints, formatPostal, sectorOf } from '$lib/data/postal-points.js';
import { urls } from '$lib/data/postal-sg.js';
import { matcher } from '../pattern.js';

/** Return the matching points (not just counts) for results up to this size... */
const SELECTION_MAX_POINTS = 8000;
/** ...and add their addresses when they span at most this many sectors. */
const ADDRESS_MAX_SECTORS = 4;
const COORD_DECIMALS = 6; // ~0.1 m; Float32 holds about this much anyway

/** @type {{ count: number, codes: Uint32Array, lons: Float32Array, lats: Float32Array }} */
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
async function load(url) {
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
		// As text: cloning one string to the page is cheap, and MapLibre parses it in its
		// own worker, so the page never holds 140,000 feature objects.
		const geojson = JSON.stringify(toFeatureCollection(all, null));
		return {
			success: true,
			geojson,
			count: points.count,
			unique: countUnique(all),
			sectors: sectorStart.size,
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

/** "264B COMPASSVALE BOW THE CORIS SINGAPORE 542264" → "264B COMPASSVALE BOW THE CORIS" */
/** @param {string} address */
const shortAddress = (address) => address.replace(/\s+SINGAPORE\s+\d{6}$/, '');

/** @param {number[]} indices @returns {Promise<Map<number, string> | null>} */
async function addressesFor(indices) {
	if (indices.length === 0) return null;
	const sectors = [...new Set(indices.map((i) => sectorOf(points.codes[i])))];
	if (sectors.length > ADDRESS_MAX_SECTORS) return null;
	const lists = await Promise.all(sectors.map(loadSectorAddresses));
	const bySector = new Map(sectors.map((s, k) => [s, lists[k]]));
	const result = new Map();
	for (const i of indices) {
		const sector = postals[i].slice(0, 2);
		const address = bySector.get(sector)?.[i - (sectorStart.get(sector) ?? 0)];
		if (address !== undefined) result.set(i, shortAddress(address));
	}
	return result;
}

/** @param {string} pattern @returns {number[]} indices of matching points */
function filterIndices(pattern) {
	if (!points) return [];
	const match = matcher(pattern);
	const out = [];
	for (let i = 0; i < points.count; i++) if (match(postals[i])) out.push(i);
	return out;
}

/** Codes are sorted, so repeats sit next to each other. @param {number[]} indices */
function countUnique(indices) {
	let unique = 0;
	for (let k = 0; k < indices.length; k++) {
		if (k === 0 || points.codes[indices[k]] !== points.codes[indices[k - 1]]) unique++;
	}
	return unique;
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
			self.postMessage({ type: 'LOAD_COMPLETE', data: await load(data?.url ?? urls.points) });
			break;
		}

		case 'FILTER': {
			const { pattern } = data;
			const indices = filterIndices(pattern);
			const small = indices.length <= SELECTION_MAX_POINTS;
			const addresses = small ? await addressesFor(indices) : null;
			self.postMessage({
				type: 'FILTER_COMPLETE',
				data: {
					pattern,
					count: indices.length,
					unique: countUnique(indices),
					bounds: calculateBounds(indices),
					features: small ? toFeatureCollection(indices, addresses) : null
				}
			});
			break;
		}

		default:
			self.postMessage({ type: 'ERROR', data: { message: 'Unknown message type' } });
	}
};
