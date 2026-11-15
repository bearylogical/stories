<!--
	Applies a MapView to the map from inside <MapLibre> (where the map context lives).
	Every View is applied in full, so the map ends up the same however the reader got there.
-->
<script lang="ts">
	import { getMapContext } from 'svelte-maplibre-gl';
	import { prefersReducedMotion } from 'svelte/motion';
	import type { FilterSpecification, Map as MaplibreMap } from 'maplibre-gl';
	import { cameraAt, cameraOptions, type MapView } from './map-view';

	interface Props {
		view: MapView;
		progress: number;
		duration: number;
	}

	let { view, progress, duration }: Props = $props();

	const mapCtx = getMapContext();
	const viewKey = $derived(JSON.stringify(view));

	// Camera: fly when the View changes; follow the scroll directly while scrubbing one View.
	let lastKey: string | undefined;
	$effect(() => {
		const map = mapCtx.map;
		if (!map) return;
		const camera = cameraOptions(cameraAt(view.camera ?? {}, view.to, progress));
		const isNewView = viewKey !== lastKey;
		lastKey = viewKey;

		if (prefersReducedMotion.current) {
			map.jumpTo(camera);
		} else if (isNewView) {
			map.flyTo({ ...camera, duration, essential: false });
		} else if (map.isMoving()) {
			// Still flying into this View: retarget the flight instead of cutting it short.
			map.flyTo({ ...camera, duration: duration / 4, essential: false });
		} else {
			map.jumpTo(camera);
		}
	});

	// Layers and filters: apply now, and again whenever the Story adds a layer.
	let current: MapView = view;
	const filtered = new Set<string>();

	function applyLayers(map: MaplibreMap) {
		const visible = current.layers ? new Set(current.layers) : undefined;
		for (const id of mapCtx.userLayers) {
			if (!map.getLayer(id)) continue;
			const want = !visible || visible.has(id) ? 'visible' : 'none';
			const have = map.getLayoutProperty(id, 'visibility') ?? 'visible';
			if (want !== have) map.setLayoutProperty(id, 'visibility', want);
		}

		const filters = current.filters ?? {};
		for (const [id, filter] of Object.entries(filters)) {
			if (!map.getLayer(id)) continue;
			if (JSON.stringify(map.getFilter(id)) !== JSON.stringify(filter)) {
				map.setFilter(id, filter as FilterSpecification);
			}
			filtered.add(id);
		}
		for (const id of filtered) {
			if (id in filters) continue;
			if (map.getLayer(id)) map.setFilter(id, null);
			filtered.delete(id);
		}
	}

	$effect(() => {
		const map = mapCtx.map;
		if (!map) return;
		current = view; // re-runs whenever the View changes
		applyLayers(map);
	});

	$effect(() => {
		const map = mapCtx.map;
		if (!map) return;
		const onStyleData = () => applyLayers(map);
		map.on('styledata', onStyleData);
		return () => {
			map.off('styledata', onStyleData);
		};
	});
</script>
