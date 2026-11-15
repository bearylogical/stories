<!--
	A Stage that shows a map (svelte-maplibre-gl). Its View is a `MapView`: camera, visible
	layers and filters. The Story provides its own sources and layers as children:

	```svelte
	<MapStage {view} {progress} style={…}>
		<GeoJSONSource data={…}>
			<CircleLayer id="points" paint={…} />
		</GeoJSONSource>
	</MapStage>
	```

	Give every layer an `id`, and let Views (not `layout.visibility` or `filter` props) decide
	which layers are visible and how they are filtered.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { untrack } from 'svelte';
	import { MapLibre } from 'svelte-maplibre-gl';
	import type { StyleSpecification } from 'maplibre-gl';
	import type { StageProps } from '$lib/scrolly/types';
	import MapViewController from './MapViewController.svelte';
	import { cameraAt, cameraOptions, type MapView } from './map-view';

	interface Props extends StageProps<MapView> {
		/** Base-map style URL or object. */
		style: string | StyleSpecification;
		/** Let the reader pan and zoom (e.g. in an Explorer). Off by default. */
		interactive?: boolean;
		/** Milliseconds to fly between Views. */
		duration?: number;
		/** The Story's sources and layers. */
		children?: Snippet;
	}

	let { view, progress, style, interactive = false, duration = 1600, children }: Props = $props();

	// Start where the first View looks, so the map doesn't fly in from the default camera.
	const start = untrack(() => cameraOptions(cameraAt(view.camera ?? {}, view.to, progress)));
</script>

<MapLibre
	{style}
	{interactive}
	center={start.center ?? [0, 0]}
	zoom={start.zoom ?? 1}
	pitch={start.pitch ?? 0}
	bearing={start.bearing ?? 0}
	attributionControl={{ compact: true }}
	class="map-stage"
>
	<MapViewController {view} {progress} {duration} />
	{@render children?.()}
</MapLibre>

<style>
	:global(.map-stage) {
		width: 100%;
		height: 100%;
	}
</style>
