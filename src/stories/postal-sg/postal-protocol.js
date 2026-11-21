// The messages between postal-sg's page (postal-data.svelte.ts) and its points worker
// (workers/postal-worker.js), and the shapes they carry. Both sides import these, so a
// message name or a result field is spelled in one place.
//
//   page → worker   LOAD_DATA { url }              worker → page   LOAD_COMPLETE PostalLoaded
//                   FILTER { id, pattern }                         FILTER_COMPLETE { id, result }
//                                                                  ERROR { id?, message }

export const MESSAGES = /** @type {const} */ ({
	LOAD_DATA: 'LOAD_DATA',
	FILTER: 'FILTER',
	LOAD_COMPLETE: 'LOAD_COMPLETE',
	FILTER_COMPLETE: 'FILTER_COMPLETE',
	ERROR: 'ERROR'
});

/**
 * @typedef {object} PostalProperties
 * @property {string} POSTAL six-digit, zero-padded postal code
 * @property {string} [ADDRESS] without the trailing "SINGAPORE <code>"; only on small results
 */

/** @typedef {import('geojson').FeatureCollection<import('geojson').Point, PostalProperties>} PostalPoints */

/** @typedef {[[west: number, south: number], [east: number, north: number]]} Bounds */

/**
 * @typedef {object} PostalResult
 * @property {string} pattern
 * @property {number} count points (addresses) matching; several can share one code
 * @property {number} unique distinct postal codes matching
 * @property {Bounds | null} bounds
 * @property {PostalPoints | null} features the matching points, only for results of up to a
 *   few thousand
 */

/**
 * @typedef {object} PostalOverview
 * @property {number} count every point
 * @property {number} unique distinct postal codes
 * @property {number} sectors sectors (first two digits) in use
 * @property {Bounds | null} bounds
 */

/**
 * @typedef {({ success: true, geojson: string } & PostalOverview) | { success: false, error: string }} PostalLoaded
 *   `geojson` is every point as a GeoJSON string, for the map's source.
 */

/**
 * @typedef {{ type: typeof MESSAGES.LOAD_DATA, data: { url: string } }
 *   | { type: typeof MESSAGES.FILTER, data: { id: number, pattern: string } }} ToWorker
 */

/**
 * @typedef {{ type: typeof MESSAGES.LOAD_COMPLETE, data: PostalLoaded }
 *   | { type: typeof MESSAGES.FILTER_COMPLETE, data: { id: number, result: PostalResult } }
 *   | { type: typeof MESSAGES.ERROR, data: { id?: number, message: string } }} FromWorker
 */
