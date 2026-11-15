// Packed binary format for postal-sg's postal code points (docs/adr/0005).
//
// Layout, all little-endian:
//   bytes 0..3    magic "PSPT"
//   bytes 4..7    Uint32 format version (FORMAT_VERSION)
//   bytes 8..11   Uint32 point count n
//   bytes 12..15  Uint32 reserved (0)
//   then          Uint32[n] postal codes, sorted ascending
//   then          Float32[n] longitudes
//   then          Float32[n] latitudes
//
// 12 bytes per point. The columns are stored one after the other (not
// interleaved) so the reader can view them as typed arrays without copying,
// and so each column compresses well.
//
// Address text is not in this file. It lives in one JSON file per sector (the
// first two digits of the postal code): an array of address strings in the
// same order as that sector's points here. Because codes are sorted, each
// sector is one contiguous run of points.

export const MAGIC = 'PSPT';
export const FORMAT_VERSION = 1;
export const HEADER_BYTES = 16;

/**
 * @param {{ code: number, lon: number, lat: number }[]} points sorted by code
 * @returns {Uint8Array}
 */
export function encodePostalPoints(points) {
	const n = points.length;
	const buffer = new ArrayBuffer(HEADER_BYTES + n * 12);
	const view = new DataView(buffer);
	for (let i = 0; i < 4; i++) view.setUint8(i, MAGIC.charCodeAt(i));
	view.setUint32(4, FORMAT_VERSION, true);
	view.setUint32(8, n, true);
	view.setUint32(12, 0, true);

	const codes = new Uint32Array(buffer, HEADER_BYTES, n);
	const lons = new Float32Array(buffer, HEADER_BYTES + n * 4, n);
	const lats = new Float32Array(buffer, HEADER_BYTES + n * 8, n);
	for (let i = 0; i < n; i++) {
		if (i > 0 && points[i].code < points[i - 1].code) {
			throw new Error(`Points must be sorted by code (index ${i})`);
		}
		codes[i] = points[i].code;
		lons[i] = points[i].lon;
		lats[i] = points[i].lat;
	}
	return new Uint8Array(buffer);
}

/**
 * Typed-array views are used directly, so this needs a little-endian host
 * (every browser and Node platform this runs on).
 * @param {ArrayBuffer} buffer
 * @returns {{ count: number, codes: Uint32Array, lons: Float32Array, lats: Float32Array }}
 */
export function decodePostalPoints(buffer) {
	const view = new DataView(buffer);
	const magic = String.fromCharCode(
		view.getUint8(0),
		view.getUint8(1),
		view.getUint8(2),
		view.getUint8(3)
	);
	if (magic !== MAGIC) throw new Error(`Not a postal points file (magic ${magic})`);
	const version = view.getUint32(4, true);
	if (version !== FORMAT_VERSION) throw new Error(`Unsupported postal points version ${version}`);
	const count = view.getUint32(8, true);
	if (buffer.byteLength !== HEADER_BYTES + count * 12) {
		throw new Error(`Postal points file is ${buffer.byteLength} bytes, expected ${HEADER_BYTES + count * 12}`);
	}
	return {
		count,
		codes: new Uint32Array(buffer, HEADER_BYTES, count),
		lons: new Float32Array(buffer, HEADER_BYTES + count * 4, count),
		lats: new Float32Array(buffer, HEADER_BYTES + count * 8, count)
	};
}

/** The sector of a postal code: its first two digits, e.g. 542264 → "54".
 * @param {number} code */
export function sectorOf(code) {
	return String(Math.floor(code / 10000)).padStart(2, '0');
}

/** Six-digit, zero-padded postal code string, e.g. 18906 → "018906".
 * @param {number} code */
export function formatPostal(code) {
	return String(code).padStart(6, '0');
}
