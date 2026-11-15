import type { FilterSpecification, LngLatLike } from 'maplibre-gl';

/** Where the map's camera points. Missing fields keep their current value. */
export interface MapCamera {
	center?: [lng: number, lat: number];
	zoom?: number;
	pitch?: number;
	bearing?: number;
}

/**
 * The View of a MapStage: what a Step asks the map to show.
 *
 * - `camera`: where to look.
 * - `to`: for a Scrub Step, where the camera ends at `progress = 1`; it moves from `camera`
 *   to `to` as the reader scrolls. Without Scrub (or with reduced motion) the map shows `to`.
 * - `layers`: ids of the Story's layers to show; the Story's other layers are hidden.
 *   Leave it out to show all of them. Base-map layers are never touched.
 * - `filters`: a filter per layer id. A layer filtered by an earlier View and not listed
 *   here goes back to no filter, so every View gives the same map however the reader got there.
 */
export interface MapView {
	camera?: MapCamera;
	to?: MapCamera;
	layers?: string[];
	filters?: Record<string, FilterSpecification>;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The camera at `t` (0–1) between `from` and `to`. */
export function cameraAt(from: MapCamera, to: MapCamera | undefined, t: number): MapCamera {
	if (!to) return from;
	const mix = (a: number | undefined, b: number | undefined) =>
		a === undefined ? b : b === undefined ? a : lerp(a, b, t);
	const center =
		from.center && to.center
			? ([lerp(from.center[0], to.center[0], t), lerp(from.center[1], to.center[1], t)] as [
					number,
					number
				])
			: (to.center ?? from.center);
	return {
		center,
		zoom: mix(from.zoom, to.zoom),
		pitch: mix(from.pitch, to.pitch),
		bearing: mix(from.bearing, to.bearing)
	};
}

/** Drops undefined fields, for maplibre's jumpTo / flyTo. */
export function cameraOptions(camera: MapCamera): {
	center?: LngLatLike;
	zoom?: number;
	pitch?: number;
	bearing?: number;
} {
	return Object.fromEntries(Object.entries(camera).filter(([, v]) => v !== undefined));
}
