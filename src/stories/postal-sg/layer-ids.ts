/**
 * The ids of postal-sg's own map layers, written once. PostalLayers.svelte and
 * Buildings.svelte define the layers with them; ./views.ts groups them for the Steps' Views.
 *
 * (A plain module rather than a `<script module>` in those components: the Story's text
 * imports ./views.ts, and must not pull MapLibre in with it.)
 */
export const LAYER = {
	districtFill: 'district-fill',
	districtLine: 'district-line',
	districtLabels: 'district-labels',
	heatmap: 'postal-heatmap',
	digits: 'postal-digits',
	dots: 'postal-dots',
	addresses: 'postal-addresses',
	buildingSplit: 'building-split',
	buildingLabels: 'building-labels',
	sweep: 'postal-sweep',
	sweepLabel: 'postal-sweep-label',
	annotations: 'annotations'
} as const;

/** The districts source's property that holds the old district's number. */
export const DISTRICT_NUMBER = 'districtNumber';

/** Where a base map keeps its 3D buildings, for Buildings.svelte to restyle. */
export interface BaseBuildings {
	/** The vector source. */
	source: string;
	/** The source layer within it. */
	sourceLayer: string;
	/** The style's fill-extrusion layer that draws them. */
	layer: string;
}

/** The 3D buildings of MapTiler's streets-v2 (`streetsStyle`). */
export const STREETS_BUILDINGS: BaseBuildings = {
	source: 'maptiler_planet',
	sourceLayer: 'building',
	layer: 'Building 3D'
};
