<!--
	3D buildings, with the ones that hold a shown postal code in orange and labelled with its
	address. Works only while `active` and zoomed in past 15, and only for a few hundred points;
	it recomputes when the map stops moving, not while it moves.
-->
<script lang="ts">
	import {
		FillExtrusionLayer,
		GeoJSONSource,
		SymbolLayer,
		getMapContext
	} from 'svelte-maplibre-gl';
	import type { Map as MaplibreMap } from 'maplibre-gl';
	import {
		colorBuildings,
		type BuildingFeature,
		type ColoredBuildings,
		type PostalPoints
	} from './postal-data.svelte';

	interface Props {
		points: PostalPoints;
		active: boolean;
	}

	let { points, active }: Props = $props();

	const MIN_ZOOM = 15;
	const MAX_POINTS = 500;
	const EMPTY: ColoredBuildings = { type: 'FeatureCollection', features: [] };

	const mapCtx = getMapContext();
	let buildings: ColoredBuildings = $state.raw(EMPTY);

	function renderedBuildings(map: MaplibreMap): BuildingFeature[] {
		return map
			.querySourceFeatures('maptiler_planet', { sourceLayer: 'building' })
			.map((f) => ({ type: 'Feature', id: f.id, geometry: f.geometry, properties: f.properties }));
	}

	$effect(() => {
		const map = mapCtx.map;
		const features = points.features;
		if (!map || !active || features.length === 0 || features.length >= MAX_POINTS) {
			buildings = EMPTY;
			return;
		}

		let live = true;
		const update = async () => {
			if (map.getZoom() <= MIN_ZOOM) return;
			const result = await colorBuildings(features, renderedBuildings(map));
			if (live) buildings = result;
		};
		// Once the map has settled (tiles loaded) after each move.
		const onMoveEnd = () => map.once('idle', update);
		map.on('moveend', onMoveEnd);
		if (!map.isMoving()) map.once('idle', update);
		return () => {
			live = false;
			map.off('moveend', onMoveEnd);
			map.off('idle', update);
		};
	});
</script>

<GeoJSONSource id="buildings" data={buildings} promoteId="id">
	<FillExtrusionLayer
		id="building-extrusions"
		paint={{
			'fill-extrusion-color': ['get', 'building_color'],
			'fill-extrusion-height': ['get', 'render_height'],
			'fill-extrusion-base': ['get', 'render_min_height'],
			'fill-extrusion-opacity': 0.7
		}}
	/>
	<SymbolLayer
		id="building-labels"
		paint={{
			'text-color': '#000',
			'text-halo-color': '#fff',
			'text-halo-width': 2,
			'text-opacity': 1
		}}
		layout={{
			'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
			'text-field': ['get', 'ADDRESS'],
			'text-size': ['interpolate', ['linear'], ['zoom'], 16, 10, 18, 14, 20, 16],
			'text-anchor': 'bottom',
			'text-justify': 'left',
			'text-allow-overlap': true,
			'text-ignore-placement': false,
			'text-variable-anchor': ['left', 'top'],
			'text-radial-offset': [
				'interpolate',
				['linear'],
				['zoom'],
				16,
				0.5,
				18,
				['/', ['get', 'render_height'], 20],
				20,
				['/', ['get', 'render_height'], 16]
			]
		}}
	/>
</GeoJSONSource>
