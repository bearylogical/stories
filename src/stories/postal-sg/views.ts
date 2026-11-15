/**
 * The parts postal-sg's Views are made of (docs/adr/0002). The Steps in `index.svx` put them
 * together; `PostalLayers.svelte` turns `pattern` into points on the map.
 */
import type { MapCamera, MapView } from '$lib/stages';
import type { PostalResult } from './postal-data.svelte';

/** A MapView plus which postal codes the points layers show (see `postal.query`). */
export interface PostalView extends MapView {
	/** `*` for all, `54*` for a sector, `54[2-4]264` for a digit range, or one exact code. */
	pattern?: string;
}

// Layer ids (defined in PostalLayers.svelte).
export const DISTRICTS = ['district-fill', 'district-line', 'district-labels'];
export const HEATMAP = ['postal-heatmap'];
export const ADDRESSES = ['postal-addresses'];
export const BUILDINGS = ['building-extrusions', 'building-labels'];

/** All of Singapore. */
export const HOME: MapCamera = { center: [103.8198, 1.3221], zoom: 10, pitch: 0, bearing: 0 };

// Cameras over the matching points. The centres are the middle of each pattern's bounding box
// in Story Data points.v1, where the first version of this Story flew to at run time.
/**
 * Sector 54 (`54*`), whose middle is at 103.8931, 1.3758. The camera looks a little south of
 * it, so the sector shows above the Step's card rather than under it.
 */
export const SECTOR_54: MapCamera = { center: [103.8931, 1.3258], zoom: 11, pitch: 0, bearing: 0 };
/** The blocks `542264`–`544264`. */
export const BLOCKS_264: MapCamera = {
	center: [103.89624, 1.38142],
	zoom: 18,
	pitch: 60,
	bearing: 35
};
/** Block `542264`. */
export const BLOCK_542264: MapCamera = {
	center: [103.89655, 1.38129],
	zoom: 18,
	pitch: 45,
	bearing: 35
};
/** Every `54?264` in the sector. */
export const SECTOR_54_264: MapCamera = {
	center: [103.89214, 1.37509],
	zoom: 14,
	pitch: 0,
	bearing: 0
};

/** The Explorer before the reader types anything. */
export const EXPLORER_START: PostalView = { camera: HOME, layers: HEATMAP, pattern: '*' };

/** Zoom in by 1.6 per digit typed, from 10 (none) to 18. */
export function zoomForDigits(digits: string): number {
	return Math.round(Math.min(10 + digits.length * 1.6, 18) * 10) / 10;
}

/**
 * The View for what the reader typed into the Explorer, once its points are found.
 * A handful of points from five or more digits: tilt over the buildings. Otherwise: the
 * heatmap, zoomed in by the number of digits.
 */
export function explorerView(digits: string, result: PostalResult): PostalView {
	if (digits === '' || !result.bounds) return EXPLORER_START;
	const [[west, south], [east, north]] = result.bounds;
	const center: [number, number] = [(west + east) / 2, (south + north) / 2];
	if (result.count < 6 && digits.length > 4) {
		return {
			camera: { center, zoom: 18, pitch: 25, bearing: 35 },
			layers: BUILDINGS,
			pattern: result.pattern
		};
	}
	return {
		camera: { center, zoom: zoomForDigits(digits), pitch: 0, bearing: 0 },
		layers: [...HEATMAP, ...BUILDINGS],
		pattern: result.pattern
	};
}
