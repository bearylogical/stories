import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { matcher, parsePattern, patternFilter } from './pattern.js';

// The map runs `patternFilter`'s expression with MapLibre's own evaluator. The style spec is
// a dependency of maplibre-gl rather than of this project, so it's loaded from there: the
// same copy the map uses.
const fromMaplibre = createRequire(createRequire(import.meta.url).resolve('maplibre-gl'));
/** @type {{ featureFilter: (filter: unknown) => { filter: (globals: object, feature: object) => boolean } }} */
const { featureFilter } = fromMaplibre('@maplibre/maplibre-gl-style-spec');

/** @param {string} pattern @returns {(postal: string) => boolean} */
function mapMatcher(pattern) {
	const filter = patternFilter(pattern);
	if (filter === undefined) return () => true; // no filter: every point is drawn
	const { filter: test } = featureFilter(filter);
	return (postal) => test({ zoom: 14 }, { type: 1, properties: { POSTAL: postal } });
}

/** A small deterministic PRNG (mulberry32), so a failure can be reproduced. */
function random(seed = 1) {
	return () => {
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
	};
}

const rand = random(2026);
const pick = (/** @type {number} */ n) => Math.floor(rand() * n);
const digit = () => String(pick(10));

/** A valid pattern: six positions of digits or digit ranges, with at most one `*`. */
function randomPattern() {
	const positions = Array.from({ length: 6 }, () => {
		if (rand() < 0.75) return digit();
		const a = pick(10);
		return `[${a}-${a + pick(10 - a)}]`;
	});
	if (rand() < 0.7) {
		// Replace a run of positions (possibly none) with `*`.
		const start = pick(7);
		const end = start + pick(7 - start);
		positions.splice(start, end - start, '*');
	}
	return positions.join('');
}

const HAND_PICKED = [
	'*',
	'5*',
	'54*',
	'54[2-4]264',
	'54*264',
	'54[5-9]*',
	'542264',
	'018906',
	'*9',
	'*[0-3]',
	'[0-1]*',
	'1*2',
	'54[3-3]*',
	'123456*',
	'*123456',
	'54[2-4][1-3]*'
];
const INVALID = ['', '12', '1234567', '**', '54[4-2]*', '54[2-4*', 'a*'];

/** Codes near the patterns above, plus random ones. */
const POSTALS = [
	'542264',
	'543264',
	'549264',
	'541264',
	'018906',
	'000000',
	'999999',
	'123456',
	'120002',
	'540000',
	...Array.from({ length: 600 }, () => Array.from({ length: 6 }, digit).join(''))
];

describe('parsePattern', () => {
	it.each([
		['*', [null, null, null, null, null, null]],
		['54*', [['5'], ['4'], null, null, null, null]],
		['54[2-4]264', [['5'], ['4'], ['2', '3', '4'], ['2'], ['6'], ['4']]],
		['54*264', [['5'], ['4'], null, ['2'], ['6'], ['4']]]
	])('reads %s', (pattern, positions) => {
		expect(parsePattern(pattern)).toEqual(positions);
	});

	it.each(INVALID)('rejects %j', (pattern) => {
		expect(parsePattern(pattern)).toBeNull();
	});
});

describe('matcher and patternFilter', () => {
	const patterns = [...HAND_PICKED, ...INVALID, ...Array.from({ length: 150 }, randomPattern)];

	it.each(patterns)('agree on %j', (pattern) => {
		const inWorker = matcher(pattern);
		const onMap = mapMatcher(pattern);
		const disagreements = POSTALS.filter((p) => inWorker(p) !== onMap(p));
		expect(disagreements).toEqual([]);
	});

	it('match what the pattern says', () => {
		const match = matcher('54[2-4]264');
		expect(['542264', '543264', '544264'].every(match)).toBe(true);
		expect(['541264', '545264', '542265'].some(match)).toBe(false);
	});

	it('match nothing for an invalid pattern', () => {
		expect(POSTALS.some(matcher('54[4-2]*'))).toBe(false);
		expect(POSTALS.some(mapMatcher('54[4-2]*'))).toBe(false);
	});
});
