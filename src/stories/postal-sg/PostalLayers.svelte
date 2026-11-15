<!--
	postal-sg's sources and layers, inside its MapStage. Which layers show, and where the camera
	goes, is up to the View; this component only fetches the points the View's `pattern` asks for.
	Layer ids are listed in ./views.ts.
-->
<script lang="ts">
	import {
		FillLayer,
		GeoJSONSource,
		HeatmapLayer,
		LineLayer,
		SymbolLayer,
		getMapContext
	} from 'svelte-maplibre-gl';
	import { urls } from '$lib/data/postal-sg.js';
	import districtCentersUrl from './district-centers.geojson?url';
	import Buildings from './Buildings.svelte';
	import { NO_POINTS, postal, type PostalPoints } from './postal-data.svelte';
	import { BUILDINGS, type PostalView } from './views';

	interface Props {
		view: PostalView;
	}

	let { view }: Props = $props();

	/** Above this zoom the heatmap gives way to buildings. */
	const BUILDING_ZOOM_START = 16;

	const mapCtx = getMapContext();
	mapCtx.waitForStyleLoaded((map) => {
		// The base map's own 3D buildings would hide ours.
		if (map.getLayer('Building 3D')) map.setLayoutProperty('Building 3D', 'visibility', 'none');
		// Load the points once the map has drawn, so they don't hold up the first tiles.
		map.once('idle', () => postal.load().catch(() => {}));
	});

	let points: PostalPoints = $state.raw(NO_POINTS);

	$effect(() => {
		const pattern = view.pattern;
		if (!pattern) return;
		let live = true;
		postal
			.query(pattern)
			.then((result) => {
				if (live) points = result.features;
			})
			.catch(() => {});
		return () => {
			live = false;
		};
	});

	const showBuildings = $derived(!view.layers || view.layers.some((id) => BUILDINGS.includes(id)));
</script>

<Buildings {points} active={showBuildings} />

<GeoJSONSource id="districts" data={urls.districts} promoteId="name">
	<FillLayer
		id="district-fill"
		minzoom={8}
		maxzoom={14}
		paint={{
			'fill-color': '#006000',
			'fill-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.6, 14, 0.1]
		}}
	/>
	<LineLayer
		id="district-line"
		minzoom={8}
		layout={{ 'line-cap': 'round', 'line-join': 'round' }}
		paint={{ 'line-color': '#003300', 'line-width': 0.7 }}
	/>
</GeoJSONSource>

<GeoJSONSource id="district-centers" data={districtCentersUrl} promoteId="district">
	<SymbolLayer
		id="district-labels"
		minzoom={9}
		paint={{
			'text-color': '#010',
			'text-halo-color': '#fff',
			'text-halo-width': 1.5,
			'text-halo-blur': 1
		}}
		layout={{
			'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
			'text-allow-overlap': false,
			'text-field': ['get', 'district'],
			'text-size': ['interpolate', ['linear'], ['zoom'], 10, 12, 14, 14, 18, 16],
			'text-offset': [0, 0]
		}}
	/>
</GeoJSONSource>

<GeoJSONSource
	id="postal-points"
	data={points}
	cluster={true}
	clusterMaxZoom={17}
	clusterRadius={3}
	promoteId="POSTAL"
>
	<HeatmapLayer
		id="postal-heatmap"
		minzoom={9}
		maxzoom={BUILDING_ZOOM_START}
		paint={{
			// Clusters of nearby codes weigh more, up to 5 codes; a lone code weighs 1.
			'heatmap-weight': [
				'interpolate',
				['linear'],
				['coalesce', ['get', 'point_count'], 5],
				0,
				0,
				1,
				0.5,
				5,
				1
			],
			'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 19, 3],
			'heatmap-color': [
				'interpolate',
				['linear'],
				['heatmap-density'],
				0,
				'rgba(33,102,172,0)',
				0.2,
				'rgb(103,169,207)',
				0.4,
				'rgb(209,229,240)',
				0.6,
				'rgb(253,219,199)',
				0.8,
				'rgb(239,138,98)',
				1,
				'rgb(178,24,43)'
			],
			'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 9, 5, 19, 8],
			'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 10, 1, 22, 0]
		}}
	/>
	<SymbolLayer
		id="postal-addresses"
		layout={{
			'text-field': ['format', 'Address: ', {}, ['get', 'ADDRESS'], {}],
			'text-variable-anchor': ['right', 'top'],
			'text-offset': [0.5, 0.1],
			'text-allow-overlap': false,
			'text-ignore-placement': false,
			'text-justify': 'left'
		}}
		paint={{
			'text-halo-width': ['interpolate', ['linear'], ['zoom'], 8, 2, 13, 1],
			'text-opacity': ['interpolate', ['linear'], ['zoom'], 8, 1, 13, 0.9]
		}}
	/>
</GeoJSONSource>
