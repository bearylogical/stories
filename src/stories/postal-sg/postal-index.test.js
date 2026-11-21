import { describe, expect, it, vi } from 'vitest';
import { decodePostalPoints, encodePostalPoints, sectorOf } from '$lib/data/postal-points.js';
import { createPostalIndex } from './postal-index.js';

// A few points in three sectors, sorted the way the build sorts them: by code, then address.
const SOURCE = [
	{ code: 18906, lon: 103.851, lat: 1.2801, address: '10 MARINA BLVD SINGAPORE 018906' },
	{ code: 18906, lon: 103.8512, lat: 1.2803, address: '12 MARINA BLVD SINGAPORE 018906' },
	{ code: 542264, lon: 103.8999, lat: 1.3912, address: '264B COMPASSVALE BOW SINGAPORE 542264' },
	{ code: 543264, lon: 103.9001, lat: 1.3915, address: '264C COMPASSVALE BOW SINGAPORE 543264' },
	{ code: 544264, lon: 103.9003, lat: 1.3918, address: '264D COMPASSVALE BOW SINGAPORE 544264' },
	{ code: 548264, lon: 103.9005, lat: 1.392, address: '264H COMPASSVALE BOW SINGAPORE 548264' },
	{ code: 819663, lon: 103.9886, lat: 1.3592, address: '80 AIRPORT BLVD SINGAPORE 819663' }
];

/** @param {typeof SOURCE} source */
function fixture(source = SOURCE) {
	const bytes = encodePostalPoints(source);
	const buffer = /** @type {ArrayBuffer} */ (bytes.buffer);
	/** @type {Map<string, string[]>} */
	const bySector = new Map();
	for (const p of source) {
		const sector = sectorOf(p.code);
		if (!bySector.has(sector)) bySector.set(sector, []);
		bySector.get(sector)?.push(p.address);
	}
	const loadAddresses = vi.fn(
		/** @type {import('./postal-index.js').LoadAddresses} */ (
			async (sector) => bySector.get(sector) ?? null
		)
	);
	return { buffer, bySector, loadAddresses };
}

describe('encodePostalPoints / decodePostalPoints', () => {
	it('round-trips codes exactly and positions to under a metre', () => {
		const decoded = decodePostalPoints(fixture().buffer);
		expect(decoded.count).toBe(SOURCE.length);
		expect([...decoded.codes]).toEqual(SOURCE.map((p) => p.code));
		SOURCE.forEach((p, i) => {
			// 1e-5 degrees is about 1.1 m.
			expect(Math.abs(decoded.lons[i] - p.lon)).toBeLessThan(1e-5);
			expect(Math.abs(decoded.lats[i] - p.lat)).toBeLessThan(1e-5);
		});
	});

	it('refuses points that are not sorted by code', () => {
		expect(() => encodePostalPoints([SOURCE[2], SOURCE[0]])).toThrow(/sorted/);
	});
});

describe('createPostalIndex', () => {
	it('summarises every point', () => {
		const { buffer, loadAddresses } = fixture();
		const index = createPostalIndex(buffer, loadAddresses);
		expect(index.overview).toMatchObject({ count: 7, unique: 6, sectors: 3 });
		expect(index.overview.bounds?.[0][0]).toBeCloseTo(103.851, 5);
		expect(index.overview.bounds?.[1][1]).toBeCloseTo(1.392, 5);
		expect(index.allPoints().features.map((f) => f.properties)).toEqual(
			SOURCE.map((p) => ({ POSTAL: String(p.code).padStart(6, '0') }))
		);
		expect(loadAddresses).not.toHaveBeenCalled();
	});

	it.each([
		['*', 7, 6],
		['01*', 2, 1],
		['018906', 2, 1],
		['54*', 4, 4],
		['54[2-4]264', 3, 3],
		['54*264', 4, 4],
		['54[5-9]*', 1, 1],
		['55*', 0, 0],
		['bogus', 0, 0]
	])('%s matches %i points, %i codes', async (pattern, count, unique) => {
		const { buffer, loadAddresses } = fixture();
		const result = await createPostalIndex(buffer, loadAddresses).query(pattern);
		expect(result).toMatchObject({ pattern, count, unique });
		expect(result.features?.features).toHaveLength(count);
		expect(result.bounds === null).toBe(count === 0);
	});

	it('joins each point to its address, without "SINGAPORE <code>"', async () => {
		const { buffer, loadAddresses } = fixture();
		const result = await createPostalIndex(buffer, loadAddresses).query('54[2-4]264');
		expect(result.features?.features.map((f) => f.properties)).toEqual([
			{ POSTAL: '542264', ADDRESS: '264B COMPASSVALE BOW' },
			{ POSTAL: '543264', ADDRESS: '264C COMPASSVALE BOW' },
			{ POSTAL: '544264', ADDRESS: '264D COMPASSVALE BOW' }
		]);
		expect(loadAddresses).toHaveBeenCalledWith('54');
	});

	it('keeps points that share a code in address order', async () => {
		const { buffer, loadAddresses } = fixture();
		const result = await createPostalIndex(buffer, loadAddresses).query('018906');
		expect(result.features?.features.map((f) => f.properties.ADDRESS)).toEqual([
			'10 MARINA BLVD',
			'12 MARINA BLVD'
		]);
	});

	it('loads each sector once', async () => {
		const { buffer, loadAddresses } = fixture();
		const index = createPostalIndex(buffer, loadAddresses);
		await Promise.all([index.query('54*'), index.query('542264'), index.query('*')]);
		expect(loadAddresses.mock.calls.map(([s]) => s).sort()).toEqual(['01', '54', '81']);
	});

	it('leaves out addresses for results spanning too many sectors', async () => {
		const { buffer, loadAddresses } = fixture();
		const index = createPostalIndex(buffer, loadAddresses, { addressMaxSectors: 2 });
		const result = await index.query('*');
		expect(result.features?.features.every((f) => f.properties.ADDRESS === undefined)).toBe(true);
		expect(loadAddresses).not.toHaveBeenCalled();
	});

	it('leaves out the points themselves for large results', async () => {
		const { buffer, loadAddresses } = fixture();
		const result = await createPostalIndex(buffer, loadAddresses, {
			selectionMaxPoints: 3
		}).query('54*');
		expect(result).toMatchObject({ count: 4, unique: 4, features: null });
		expect(result.bounds).not.toBeNull();
	});

	describe('when a sector’s addresses don’t line up with its points', () => {
		const quiet = () => vi.spyOn(console, 'warn').mockImplementation(() => {});

		it('ignores a list of the wrong length', async () => {
			const warn = quiet();
			const { buffer } = fixture();
			const index = createPostalIndex(buffer, async () => ['ONE SINGAPORE 542264']);
			const result = await index.query('54*');
			expect(result.count).toBe(4);
			expect(result.features?.features.some((f) => f.properties.ADDRESS)).toBe(false);
			expect(warn).toHaveBeenCalled();
			warn.mockRestore();
		});

		it('ignores a list in another order', async () => {
			const warn = quiet();
			const { buffer, bySector } = fixture();
			const reversed = [...(bySector.get('54') ?? [])].reverse();
			const index = createPostalIndex(buffer, async () => reversed);
			const result = await index.query('542264');
			expect(result.features?.features[0].properties).toEqual({ POSTAL: '542264' });
			expect(warn).toHaveBeenCalled();
			warn.mockRestore();
		});

		it('tries again after a failed load', async () => {
			const warn = quiet();
			const { buffer, bySector } = fixture();
			const loadAddresses = vi
				.fn()
				.mockRejectedValueOnce(new Error('HTTP 503'))
				.mockImplementation(async (sector) => bySector.get(sector));
			const index = createPostalIndex(buffer, loadAddresses);
			expect(
				(await index.query('819663')).features?.features[0].properties.ADDRESS
			).toBeUndefined();
			expect((await index.query('819663')).features?.features[0].properties.ADDRESS).toBe(
				'80 AIRPORT BLVD'
			);
			warn.mockRestore();
		});
	});

	it('refuses a points file that is not sorted by code', () => {
		// Format 1 stores codes as they are, so it can hold them out of order.
		const n = 2;
		const buffer = new ArrayBuffer(16 + n * 12);
		const view = new DataView(buffer);
		[...'PSPT'].forEach((c, i) => view.setUint8(i, c.charCodeAt(0)));
		view.setUint32(4, 1, true);
		view.setUint32(8, n, true);
		new Uint32Array(buffer, 16, n).set([542264, 18906]);
		expect(() => createPostalIndex(buffer, async () => null)).toThrow(/not sorted/);
	});
});
