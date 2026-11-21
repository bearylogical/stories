/**
 * The parts postal-sg's Views are made of (docs/adr/0002). The Steps in `index.svx` put them
 * together; PostalStage.svelte works out what each View means for the map (./stage-spec.ts).
 */
import type { FeatureCollection, Point } from 'geojson';
import type { MapCamera, MapView } from '$lib/stages';
import { LAYER } from './layer-ids';
import type { PostalResult } from './postal-data.svelte';

/** A MapView plus which postal codes the points layers show. */
export interface PostalView extends MapView {
	/** A postal code pattern (see ./pattern.js), e.g. `*`, `54*`, `54[2-4]264` or `542264`. */
	pattern?: string;
	/** Highlight one old postal district by number. */
	district?: number;
	/**
	 * In a Scrub Step: reveal the pattern's points in code order as the reader scrolls, and
	 * label the one reached (SweepCaption shows it too).
	 */
	sweep?: boolean;
}

// Groups of layers (ids in ./layer-ids.ts) for a View's `layers`.
export const DISTRICTS: string[] = [LAYER.districtFill, LAYER.districtLine, LAYER.districtLabels];
export const HEATMAP: string[] = [LAYER.heatmap];
/** Every point, coloured by the first digit of its code. */
export const DIGITS: string[] = [LAYER.digits];
/** Every matching point as a dot. */
export const DOTS: string[] = [LAYER.dots];
/** Address labels for a small set of points. */
export const ADDRESSES: string[] = [LAYER.addresses];
/**
 * The base map's 3D buildings holding a shown code turn orange. Buildings.svelte colours the
 * base map's layer while this is shown, and draws the buildings it has to split itself.
 */
export const HIGHLIGHT: string[] = [LAYER.buildingSplit];
/** Highlighted buildings, labelled with their addresses. */
export const BUILDINGS: string[] = [...HIGHLIGHT, LAYER.buildingLabels];
export const SWEEP: string[] = [LAYER.sweep, LAYER.sweepLabel];
export const ANNOTATIONS: string[] = [LAYER.annotations];

/**
 * Colours for the first digit, 0–8 (9 holds two codes and shares 8's). A categorical palette
 * that stays distinct for common colour-vision deficiencies.
 */
export const DIGIT_COLORS = [
	'#4e79a7',
	'#f28e2b',
	'#e15759',
	'#76b7b2',
	'#59a14f',
	'#edc948',
	'#b07aa1',
	'#ff9da7',
	'#9c755f'
];

/** Highlighted buildings and swept points. */
export const MATCH_COLOR = '#d14200';

/** All of Singapore. */
export const HOME: MapCamera = { center: [103.8198, 1.3221], zoom: 10, pitch: 0, bearing: 0 };

// Cameras over the matching points (centres from Story Data points.v1). The Step cards sit in
// the middle of the screen, so cameras over a small area look a little south of it, to show
// it above the card.

/** Sector 54 (`54*`), part of old District 19. */
export const SECTOR_54: MapCamera = { center: [103.8834, 1.3285], zoom: 11, pitch: 0, bearing: 0 };
/** The six Block 264s on Compassvale Bow (`540264`–`544264`, `548264`). */
export const BLOCKS_264: MapCamera = {
	center: [103.896, 1.38142],
	zoom: 18,
	pitch: 50,
	bearing: 35
};
/** Block 264B, `542264`. */
export const BLOCK_542264: MapCamera = {
	center: [103.89655, 1.38129],
	zoom: 18.5,
	pitch: 45,
	bearing: 35
};
/** Every `54?264` in the sector: six blocks in Sengkang, four houses further south. */
export const SECTOR_54_264: MapCamera = {
	center: [103.8921, 1.357],
	zoom: 12.9,
	pitch: 0,
	bearing: 0
};
/** The private streets of sector 54 (`54[6-9]*`), around Kovan and Serangoon. */
export const PRIVATE_54: MapCamera = {
	center: [103.882, 1.344],
	zoom: 13.2,
	pitch: 0,
	bearing: 0
};

/** Places the heatmap's gaps and clusters are explained by. */
export const PLACES: FeatureCollection<Point, { name: string }> = {
	type: 'FeatureCollection',
	features: (
		[
			['Central Catchment', 103.805, 1.372],
			['Western Water Catchment', 103.675, 1.385],
			['Changi Airport', 103.989, 1.357],
			['Downtown', 103.851, 1.284],
			['Katong', 103.905, 1.305],
			['Serangoon Gardens', 103.866, 1.364],
			['Tampines (HDB)', 103.944, 1.354],
			['Jurong West (HDB)', 103.705, 1.34]
		] as const
	).map(([name, lon, lat]) => ({
		type: 'Feature',
		properties: { name },
		geometry: { type: 'Point', coordinates: [lon, lat] }
	}))
};

/** The Explorer before the reader types anything. */
export const EXPLORER_START: PostalView = {
	camera: HOME,
	layers: HEATMAP,
	pattern: '*',
	interactive: true
};

/** Patterns the Steps show, queried ahead of time (see `postal.prefetch`). */
export const STORY_PATTERNS = ['54*', '54*264', '542264', '54[6-9]*'];

/** Zoom in by 1.6 per digit typed, from 10 (none) to 18. */
export function zoomForDigits(digits: string): number {
	return Math.round(Math.min(10 + digits.length * 1.6, 18) * 10) / 10;
}

/**
 * The View for what the reader typed into the Explorer, once its points are found.
 * A handful of points from five or more digits: tilt over the buildings. Otherwise: the
 * heatmap and dots, zoomed in by the number of digits.
 */
export function explorerView(digits: string, result: PostalResult): PostalView {
	if (digits === '' || !result.bounds) return EXPLORER_START;
	const [[west, south], [east, north]] = result.bounds;
	const center: [number, number] = [(west + east) / 2, (south + north) / 2];
	if (result.count < 6 && digits.length > 4) {
		return {
			camera: { center, zoom: 18, pitch: 45, bearing: 35 },
			layers: [...DOTS, ...BUILDINGS],
			pattern: result.pattern,
			interactive: true
		};
	}
	return {
		camera: { center, zoom: zoomForDigits(digits), pitch: 0, bearing: 0 },
		layers: [...HEATMAP, ...DOTS, ...ADDRESSES],
		pattern: result.pattern,
		interactive: true
	};
}
