/**
 * Everything a PostalView implies for the map, as pure functions. PostalStage.svelte is the
 * only caller: it fetches the View's points (`selection`) and hands the result to MapStage,
 * PostalLayers and the Sweep's caption.
 *
 * - `sweepAt`: which point a Sweep has reached at `progress`.
 * - `postalMapView`: the generic MapView for MapStage, with the View's `pattern`, `district`
 *   and Sweep cursor turned into layer filters.
 * - `showsBuildings`: whether the base map's buildings are coloured.
 */
import type { FilterSpecification } from 'maplibre-gl';
import type { Feature, Point } from 'geojson';
import type { MapView } from '$lib/stages';
import { patternFilter } from './pattern.js';
import type { PostalPoints, PostalProperties } from './postal-data.svelte';
import { DISTRICT_NUMBER, LAYER } from './layer-ids';
import { DIGITS, DOTS, HEATMAP, HIGHLIGHT, type PostalView } from './views';

export type PostalPoint = Feature<Point, PostalProperties>;

/** The points (with addresses) found for a pattern. */
export interface Selection {
	pattern: string;
	points: PostalPoints | null;
}

/** Points layers filtered by a View's `pattern`. */
const PATTERN_LAYERS = [...HEATMAP, ...DIGITS, ...DOTS];

const NONE: PostalPoints = { type: 'FeatureCollection', features: [] };

/** The points a View's Sweep walks through (sorted by code), or none if it has no Sweep. */
export function sweepPoints(view: PostalView, selection: Selection | null): PostalPoints {
	if (!view.sweep || !selection || selection.pattern !== view.pattern) return NONE;
	return selection.points ?? NONE;
}

/**
 * The point a Sweep has reached: the reader's progress through the Step, as a share of the
 * points. Undefined without a Sweep or before its points are found.
 */
export function sweepAt(
	view: PostalView,
	selection: Selection | null,
	progress: number
): PostalPoint | undefined {
	const points = sweepPoints(view, selection).features;
	if (points.length === 0) return undefined;
	const index = Math.min(points.length - 1, Math.max(0, Math.floor(progress * points.length)));
	return points[index];
}

/**
 * The MapView for MapStage. The View's own `filters` win over the ones made here.
 * @param sweepCode the code the Sweep has reached (see `sweepAt`): points up to it show, and
 *   its address is labelled.
 */
export function postalMapView(view: PostalView, sweepCode?: string): MapView {
	const { pattern, district, sweep, ...map } = view;
	const filters: Record<string, FilterSpecification> = {};
	const filter = pattern ? patternFilter(pattern) : undefined;
	if (filter) for (const id of PATTERN_LAYERS) filters[id] = filter;
	if (district !== undefined) {
		filters[LAYER.districtFill] = ['==', ['to-number', ['get', DISTRICT_NUMBER]], district];
	}
	if (sweep) {
		if (sweepCode) filters[LAYER.sweep] = ['<=', ['get', 'POSTAL'], sweepCode];
		filters[LAYER.sweepLabel] = ['==', ['get', 'POSTAL'], sweepCode ?? ''];
	}
	return { ...map, filters: { ...filters, ...view.filters } };
}

/** Whether the View shows the highlighted buildings (all layers shown counts). */
export function showsBuildings(view: PostalView): boolean {
	return !view.layers || view.layers.some((id) => HIGHLIGHT.includes(id));
}
