<!--
	postal-sg's sources and layers, inside its MapStage. Which layers show, where the camera
	goes and how the points are filtered is up to the View (see `withPattern` in ./views.ts).
	This component loads the points once, fetches the small sets that need addresses, and
	drives the Sweep from the Scrub's progress. Layer ids are listed in ./views.ts.
-->
<script lang="ts">
	import {
		CircleLayer,
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
	import {
		DIGIT_COLORS,
		HIGHLIGHT,
		MATCH_COLOR,
		PLACES,
		STORY_PATTERNS,
		type PostalView
	} from './views';

	interface Props {
		view: PostalView;
		progress: number;
	}

	let { view, progress }: Props = $props();

	/** Above this zoom the heatmap gives way to dots and buildings. */
	const HEATMAP_MAX_ZOOM = 16;

	const mapCtx = getMapContext();
	// Once the map exists: waitForStyleLoaded ignores calls made before that.
	$effect(() => {
		if (!mapCtx.map) return;
		mapCtx.waitForStyleLoaded((map) => {
			// Load the points once the map has drawn, so they don't hold up the first tiles; then
			// look up the Steps' own patterns, so their addresses are ready before the reader is.
			map.once('idle', () =>
				postal
					.load()
					.then(() => postal.prefetch(STORY_PATTERNS))
					.catch(() => {})
			);
		});
	});

	/** The View's points, with addresses, when there are few enough. */
	let selection: PostalPoints | null = $state.raw(null);

	$effect(() => {
		const pattern = view.pattern;
		if (!pattern) {
			selection = null;
			return;
		}
		let live = true;
		postal
			.query(pattern)
			.then((result) => {
				if (live) selection = result.features;
			})
			.catch(() => {});
		return () => {
			live = false;
		};
	});

	const showBuildings = $derived(!view.layers || view.layers.some((id) => HIGHLIGHT.includes(id)));

	// The Sweep: the selection's points (sorted by code) appear one street at a time as the
	// reader scrolls. `sweepIndex` is shared with the Step's caption.
	const sweepPoints = $derived(view.sweep ? (selection ?? NO_POINTS) : NO_POINTS);
	const sweepCode = $derived.by(() => {
		const features = sweepPoints.features;
		if (features.length === 0) return undefined;
		const index = Math.min(features.length - 1, Math.floor(progress * features.length));
		return features[index].properties.POSTAL;
	});

	$effect(() => {
		const map = mapCtx.map;
		const code = sweepCode;
		if (!map || !map.getLayer('postal-sweep')) return;
		// Set here, not through the View: it changes on every scroll frame.
		map.setFilter('postal-sweep', code ? ['<=', ['get', 'POSTAL'], code] : null);
		map.setFilter('postal-sweep-label', ['==', ['get', 'POSTAL'], code ?? '']);
	});

	const digitColor = [
		'match',
		['slice', ['get', 'POSTAL'], 0, 1],
		...DIGIT_COLORS.flatMap((color, digit) => [String(digit), color]),
		DIGIT_COLORS[8]
	] as const;
</script>

<Buildings points={selection} active={showBuildings} />

<GeoJSONSource id="districts" data={urls.districts} promoteId="name">
	<FillLayer
		id="district-fill"
		minzoom={8}
		maxzoom={14}
		paint={{
			'fill-color': '#006000',
			'fill-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 14, 0.1]
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
			'text-font': ['Roboto Bold', 'Noto Sans Bold'],
			'text-allow-overlap': false,
			'text-field': ['get', 'district'],
			'text-size': ['interpolate', ['linear'], ['zoom'], 10, 12, 14, 14, 18, 16]
		}}
	/>
</GeoJSONSource>

<!-- Every point, once. Views filter it; nothing re-sends it. -->
<GeoJSONSource id="postal-points" data={postal.allPoints ?? NO_POINTS}>
	<HeatmapLayer
		id="postal-heatmap"
		minzoom={9}
		maxzoom={HEATMAP_MAX_ZOOM}
		paint={{
			'heatmap-weight': 1,
			'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 9, 0.04, 12, 0.15, 16, 0.8],
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
			'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 9, 3, 13, 7, 16, 14],
			// Fade out as the dots and buildings take over.
			'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 13, 1, HEATMAP_MAX_ZOOM, 0]
		}}
	/>
	<CircleLayer
		id="postal-digits"
		paint={{
			'circle-color': digitColor as never,
			'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 1.8, 14, 3.5],
			'circle-opacity': 0.8
		}}
	/>
	<CircleLayer
		id="postal-dots"
		paint={{
			'circle-color': '#003c57',
			'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 1, 13, 2.5, 16, 4],
			'circle-stroke-color': '#fff',
			'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 12, 0, 13, 0.5, 18, 1.5]
		}}
	/>
</GeoJSONSource>

<!-- The View's points with addresses (small sets only). -->
<GeoJSONSource id="postal-selection" data={selection ?? NO_POINTS}>
	<SymbolLayer
		id="postal-addresses"
		layout={{
			'text-font': ['Roboto Regular', 'Noto Sans Regular'],
			'text-field': ['get', 'ADDRESS'],
			'text-size': 12,
			'text-max-width': 10,
			'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
			'text-radial-offset': 0.6,
			'text-justify': 'auto',
			'text-allow-overlap': false
		}}
		paint={{
			'text-color': '#003c57',
			'text-halo-color': '#fff',
			'text-halo-width': 1.5
		}}
	/>
</GeoJSONSource>

<GeoJSONSource id="postal-sweep" data={sweepPoints}>
	<CircleLayer
		id="postal-sweep"
		paint={{
			'circle-color': MATCH_COLOR,
			'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 2, 15, 4],
			'circle-stroke-color': '#fff',
			'circle-stroke-width': 0.5
		}}
	/>
	<SymbolLayer
		id="postal-sweep-label"
		layout={{
			'text-font': ['Roboto Bold', 'Noto Sans Bold'],
			'text-field': ['get', 'ADDRESS'],
			'text-size': 14,
			'text-max-width': 12,
			'text-anchor': 'left',
			'text-offset': [0.8, 0],
			'text-allow-overlap': true,
			'icon-allow-overlap': true
		}}
		paint={{
			'text-color': '#000',
			'text-halo-color': '#fff',
			'text-halo-width': 2
		}}
	/>
</GeoJSONSource>

<GeoJSONSource id="annotations" data={PLACES}>
	<SymbolLayer
		id="annotations"
		layout={{
			'text-font': ['Roboto Italic', 'Noto Sans Italic'],
			'text-field': ['get', 'name'],
			'text-size': 13,
			'text-max-width': 8,
			'text-allow-overlap': true
		}}
		paint={{
			'text-color': '#222',
			'text-halo-color': '#fff',
			'text-halo-width': 1.5
		}}
	/>
</GeoJSONSource>
