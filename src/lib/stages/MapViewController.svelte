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
	// A new View for the camera: filters don't move it, and may change while a Step scrolls
	// (e.g. a cursor following a Scrub), which mustn't restart the camera's flight.
	const viewKey = $derived(JSON.stringify({ ...view, filters: undefined }));

	/** Whether `camera` is close enough to ease to in a straight line instead of flying. */
	function isNear(map: MaplibreMap, camera: ReturnType<typeof cameraOptions>): boolean {
		if (!camera.center) return true;
		const zoomChange = Math.abs((camera.zoom ?? map.getZoom()) - map.getZoom());
		const { x, y } = map.project(camera.center);
		const { width, height } = map.getCanvas().getBoundingClientRect();
		const onScreen = x > -width / 2 && x < width * 1.5 && y > -height / 2 && y < height * 1.5;
		return onScreen && zoomChange <= 3;
	}

	// Camera: fly to a far View, ease to a near one; follow the scroll directly while scrubbing.
	let lastKey: string | undefined;
	$effect(() => {
		const map = mapCtx.map;
		if (!map) return;
		const camera = cameraOptions(cameraAt(view.camera ?? {}, view.to, progress));
		const isNewView = viewKey !== lastKey;
		lastKey = viewKey;

		if (prefersReducedMotion.current) {
			map.jumpTo(camera);
		} else if (isNewView && isNear(map, camera)) {
			map.easeTo({ ...camera, duration: duration / 2, essential: false });
		} else if (isNewView) {
			map.flyTo({ ...camera, duration, essential: false });
		} else if (map.isMoving()) {
			// Still flying into this View: retarget the flight instead of cutting it short.
			map.flyTo({ ...camera, duration: duration / 4, essential: false });
		} else {
			map.jumpTo(camera);
		}
	});

	// Interaction: only for Views that ask for it (e.g. an Explorer).
	$effect(() => {
		const map = mapCtx.map;
		if (!map) return;
		const on = view.interactive === true;
		for (const handler of [map.dragPan, map.touchZoomRotate, map.doubleClickZoom, map.keyboard]) {
			if (on) handler.enable();
			else handler.disable();
		}
		map.getCanvas().style.cursor = on ? 'grab' : '';
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
