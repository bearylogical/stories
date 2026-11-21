import { describe, expect, it } from 'vitest';
import { keyOf } from './data-keys.js';

describe('keyOf', () => {
	it.each([
		['counts.csv', 'counts'],
		['district-counts.csv', 'districtCounts'],
		['planning-area-2019.geojson', 'planningArea2019'],
		['2024-counts.csv', '_2024Counts']
	])('%j → %j', (name, key) => {
		expect(keyOf(name)).toBe(key);
	});
});
