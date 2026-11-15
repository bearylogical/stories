// Packed binary format for postal-sg's postal code points (docs/adr/0005).
//
// Both formats start with a 16-byte header, little-endian:
//   bytes 0..3    magic "PSPT"
//   bytes 4..7    Uint32 format version
//   bytes 8..11   Uint32 point count n
//   bytes 12..15  Uint32: 0 in format 1; in format 2, the byte length of the codes
//
// Format 1 (points.v1.bin), 12 bytes per point:
//   Uint32[n] postal codes, sorted ascending
//   Float32[n] longitudes
//   Float32[n] latitudes
//
// Format 2 (points.v2.bin and later), about half the size once compressed:
//   Float64[4]   bounding box: west, south, east, north
//   codes        sorted ascending, each stored as the gap from the one before, as a
//                varint (7 bits per byte, high bit set on all but the last byte)
//   coordinates  each longitude and latitude quantised to 16 bits across the bounding
//                box (under 0.4 m of error over Singapore), then stored as the change
//                from the point before (zigzag, wrapping at 16 bits), split into a
//                high-byte plane and a low-byte plane: lon hi, lon lo, lat hi, lat lo,
//                n bytes each
//
// Points that are next to each other by code are usually next to each other on the
// ground, so the gaps and changes are small numbers that compress well.
//
// Address text is not in this file. It lives in one JSON file per sector (the
// first two digits of the postal code): an array of address strings in the
// same order as that sector's points here. Because codes are sorted, each
// sector is one contiguous run of points.

export const MAGIC = 'PSPT';
/** The format `encodePostalPoints` writes. */
export const FORMAT_VERSION = 2;
export const HEADER_BYTES = 16;
const BBOX_BYTES = 32;
const STEPS = 65535;

/**
 * @param {{ code: number, lon: number, lat: number }[]} points sorted by code
 * @returns {Uint8Array} format 2
 */
export function encodePostalPoints(points) {
	const n = points.length;
	let [west, south, east, north] = [Infinity, Infinity, -Infinity, -Infinity];
	for (let i = 0; i < n; i++) {
		const { code, lon, lat } = points[i];
		if (i > 0 && code < points[i - 1].code) {
			throw new Error(`Points must be sorted by code (index ${i})`);
		}
		west = Math.min(west, lon);
		east = Math.max(east, lon);
		south = Math.min(south, lat);
		north = Math.max(north, lat);
	}

	/** @type {number[]} */
	const codeBytes = [];
	let previous = 0;
	for (const { code } of points) {
		let gap = code - previous;
		previous = code;
		while (gap >= 0x80) {
			codeBytes.push((gap & 0x7f) | 0x80);
			gap >>>= 7;
		}
		codeBytes.push(gap);
	}

	const buffer = new ArrayBuffer(HEADER_BYTES + BBOX_BYTES + codeBytes.length + n * 4);
	const view = new DataView(buffer);
	for (let i = 0; i < 4; i++) view.setUint8(i, MAGIC.charCodeAt(i));
	view.setUint32(4, FORMAT_VERSION, true);
	view.setUint32(8, n, true);
	view.setUint32(12, codeBytes.length, true);
	[west, south, east, north].forEach((v, i) => view.setFloat64(HEADER_BYTES + i * 8, v, true));

	const bytes = new Uint8Array(buffer);
	let offset = HEADER_BYTES + BBOX_BYTES;
	bytes.set(codeBytes, offset);
	offset += codeBytes.length;

	const planes = (/** @type {(p: { lon: number, lat: number }) => number} */ quantise) => {
		const hi = new Uint8Array(n);
		const lo = new Uint8Array(n);
		let last = 0;
		for (let i = 0; i < n; i++) {
			const q = quantise(points[i]);
			let change = (q - last) & 0xffff;
			if (change > 0x7fff) change -= 0x10000;
			const zigzag = ((change << 1) ^ (change >> 15)) & 0xffff;
			hi[i] = zigzag >> 8;
			lo[i] = zigzag & 0xff;
			last = q;
		}
		return [hi, lo];
	};
	const scale = (/** @type {number} */ v, /** @type {number} */ min, /** @type {number} */ max) =>
		max > min ? Math.round(((v - min) / (max - min)) * STEPS) : 0;
	for (const plane of [
		...planes((p) => scale(p.lon, west, east)),
		...planes((p) => scale(p.lat, south, north))
	]) {
		bytes.set(plane, offset);
		offset += n;
	}
	return bytes;
}

/**
 * Reads format 1 or 2. Format 1's columns are used in place, so it needs a
 * little-endian host (every browser and Node platform this runs on).
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
	const count = view.getUint32(8, true);
	if (version === 1) return decodeV1(buffer, count);
	if (version === 2) return decodeV2(buffer, view, count);
	throw new Error(`Unsupported postal points version ${version}`);
}

/** @param {ArrayBuffer} buffer @param {number} count */
function decodeV1(buffer, count) {
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

/** @param {ArrayBuffer} buffer @param {DataView} view @param {number} count */
function decodeV2(buffer, view, count) {
	const codeLength = view.getUint32(12, true);
	const expected = HEADER_BYTES + BBOX_BYTES + codeLength + count * 4;
	if (buffer.byteLength !== expected) {
		throw new Error(`Postal points file is ${buffer.byteLength} bytes, expected ${expected}`);
	}
	const [west, south, east, north] = [0, 1, 2, 3].map((i) =>
		view.getFloat64(HEADER_BYTES + i * 8, true)
	);
	const bytes = new Uint8Array(buffer);
	let offset = HEADER_BYTES + BBOX_BYTES;

	const codes = new Uint32Array(count);
	let code = 0;
	for (let i = 0; i < count; i++) {
		let gap = 0;
		let shift = 0;
		let byte;
		do {
			byte = bytes[offset++];
			gap += (byte & 0x7f) * 2 ** shift;
			shift += 7;
		} while (byte & 0x80);
		code += gap;
		codes[i] = code;
	}

	const column = (/** @type {number} */ min, /** @type {number} */ max) => {
		const out = new Float32Array(count);
		const hi = offset;
		const lo = offset + count;
		let q = 0;
		for (let i = 0; i < count; i++) {
			const zigzag = (bytes[hi + i] << 8) | bytes[lo + i];
			const change = (zigzag >>> 1) ^ -(zigzag & 1);
			q = (q + change) & 0xffff;
			out[i] = min + (q / STEPS) * (max - min);
		}
		offset += count * 2;
		return out;
	};
	const lons = column(west, east);
	const lats = column(south, north);
	return { count, codes, lons, lats };
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
