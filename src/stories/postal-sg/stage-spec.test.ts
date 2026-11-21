import type { FilterSpecification } from 'maplibre-gl';
import { describe, expect, it } from 'vitest';
import { LAYER } from './layer-ids';
import { patternFilter } from './pattern.js';
import type { PostalPoints } from './postal-data.svelte';
import { postalMapView, showsBuildings, sweepAt, sweepPoints, type Selection } from './stage-spec';
import { BUILDINGS, DOTS, HEATMAP, HIGHLIGHT, HOME, SWEEP, type PostalView } from './views';

const points = (...codes: string[]): PostalPoints => ({
	type: 'FeatureCollection',
	features: codes.map((POSTAL) => ({
		type: 'Feature',
		properties: { POSTAL, ADDRESS: `Address ${POSTAL}` },
		geometry: { type: 'Point', coordinates: [103.88, 1.34] }
	}))
});

const SWEEP_VIEW: PostalView = { camera: HOME, layers: SWEEP, pattern: '54[6-9]*', sweep: true };
const SWEEP_SELECTION: Selection = {
	pattern: '54[6-9]*',
	points: points('546000', '546100', '547000', '549999')
};

describe('postalMapView', () => {
	it('filters the points layers by the pattern', () => {
		const map = postalMapView({ camera: HOME, layers: DOTS, pattern: '54*' });
		const filter = patternFilter('54*');
		expect(map.filters).toEqual({
			[LAYER.heatmap]: filter,
			[LAYER.digits]: filter,
			[LAYER.dots]: filter
		});
	});

	it('leaves the points unfiltered for `*` and without a pattern', () => {
		expect(postalMapView({ pattern: '*' }).filters).toEqual({});
		expect(postalMapView({}).filters).toEqual({});
	});

	it('keeps the camera, layers and interaction, and drops the postal-only fields', () => {
		const map = postalMapView({
			camera: HOME,
			layers: HEATMAP,
			interactive: true,
			pattern: '5*',
			district: 19,
			sweep: true
		});
		expect(map).toMatchObject({ camera: HOME, layers: HEATMAP, interactive: true });
		expect(map).not.toHaveProperty('pattern');
		expect(map).not.toHaveProperty('district');
		expect(map).not.toHaveProperty('sweep');
	});

	it('highlights a district by number', () => {
		const map = postalMapView({ district: 19 });
		expect(map.filters?.[LAYER.districtFill]).toEqual([
			'==',
			['to-number', ['get', 'districtNumber']],
			19
		]);
	});

	it("lets the View's own filters win", () => {
		const own: FilterSpecification = ['==', ['get', 'POSTAL'], '000000'];
		const map = postalMapView({ pattern: '54*', filters: { [LAYER.dots]: own } });
		expect(map.filters?.[LAYER.dots]).toEqual(own);
	});

	it('shows Sweep points up to the code reached, and labels that one', () => {
		const map = postalMapView(SWEEP_VIEW, '547000');
		expect(map.filters?.[LAYER.sweep]).toEqual(['<=', ['get', 'POSTAL'], '547000']);
		expect(map.filters?.[LAYER.sweepLabel]).toEqual(['==', ['get', 'POSTAL'], '547000']);
	});

	it('labels nothing before the Sweep has reached a code', () => {
		const map = postalMapView(SWEEP_VIEW);
		expect(map.filters).not.toHaveProperty(LAYER.sweep);
		expect(map.filters?.[LAYER.sweepLabel]).toEqual(['==', ['get', 'POSTAL'], '']);
	});

	it('adds no Sweep filters to a View without a Sweep', () => {
		const map = postalMapView({ pattern: '54*' }, '547000');
		expect(map.filters).not.toHaveProperty(LAYER.sweep);
		expect(map.filters).not.toHaveProperty(LAYER.sweepLabel);
	});
});

describe('sweepAt', () => {
	const code = (progress: number) =>
		sweepAt(SWEEP_VIEW, SWEEP_SELECTION, progress)?.properties.POSTAL;

	it('walks the points in order as progress goes from 0 to 1', () => {
		expect(code(0)).toBe('546000');
		expect(code(0.25)).toBe('546100');
		expect(code(0.6)).toBe('547000');
		expect(code(0.99)).toBe('549999');
	});

	it('stays on the last point at the end, and the first before the start', () => {
		expect(code(1)).toBe('549999');
		expect(code(-0.1)).toBe('546000');
	});

	it('is undefined without a Sweep, or before its points are found', () => {
		expect(sweepAt({ ...SWEEP_VIEW, sweep: false }, SWEEP_SELECTION, 0.5)).toBeUndefined();
		expect(sweepAt(SWEEP_VIEW, null, 0.5)).toBeUndefined();
		expect(sweepAt(SWEEP_VIEW, { pattern: '54[6-9]*', points: null }, 0.5)).toBeUndefined();
	});

	it("ignores points found for an earlier View's pattern", () => {
		const stale: Selection = { pattern: '54*264', points: points('540264', '545264') };
		expect(sweepAt(SWEEP_VIEW, stale, 0.5)).toBeUndefined();
		expect(sweepPoints(SWEEP_VIEW, stale).features).toEqual([]);
	});
});

describe('showsBuildings', () => {
	it('is on when the View shows the highlighted buildings, or every layer', () => {
		expect(showsBuildings({ layers: HIGHLIGHT })).toBe(true);
		expect(showsBuildings({ layers: BUILDINGS })).toBe(true);
		expect(showsBuildings({})).toBe(true);
	});

	it('is off otherwise', () => {
		expect(showsBuildings({ layers: [...HEATMAP, ...DOTS] })).toBe(false);
		expect(showsBuildings({ layers: SWEEP })).toBe(false);
	});
});
