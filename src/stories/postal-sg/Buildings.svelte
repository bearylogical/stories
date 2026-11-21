<!--
	The base map's own 3D buildings, restyled: they rise out of the ground as the camera comes
	down past zoom 15, and the ones that hold a shown postal code turn orange. Because they are
	the base map's tiles, they load while the map flies, not after it lands.

	Matching is done here, on the page: for each building in the loaded tiles, is a shown point
	inside it (or within a couple of metres)? It reruns as tiles arrive, throttled.

	- A building that is one polygon is coloured through feature state: nothing is copied.
	- Some buildings are one feature of many polygons (all of Compassvale Bow's towers share one
	  id), and feature state would colour every tower. Those features are left out of the base
	  layer and their polygons drawn here (`building-split`), each coloured on its own.
-->
<script lang="ts">
	import {
		FillExtrusionLayer,
		GeoJSONSource,
		SymbolLayer,
		getMapContext
	} from 'svelte-maplibre-gl';
	import { untrack } from 'svelte';
	import type {
		FilterSpecification,
		MapGeoJSONFeature,
		Map as MaplibreMap,
		MapSourceDataEvent
	} from 'maplibre-gl';
	import type { Feature, FeatureCollection, Polygon, Position } from 'geojson';
	import { LAYER, type BaseBuildings } from './layer-ids';
	import { NO_POINTS, type PostalPoints } from './postal-data.svelte';
	import { MATCH_COLOR } from './views';

	interface Props {
		/** The shown points, with addresses. */
		points: PostalPoints | null;
		/** Whether the View shows buildings. */
		active: boolean;
		/** Where the base map keeps its 3D buildings. */
		base: BaseBuildings;
	}

	let { points, active, base }: Props = $props();

	// The base style is the Stage's choice, fixed for the map's life.
	const { source: SOURCE, sourceLayer: SOURCE_LAYER, layer: BASE_LAYER } = untrack(() => base);
	const OTHER_COLOR = '#c9c4ba';
	/** Below this the base map has no 3D buildings. */
	const MIN_ZOOM = 14.5;
	/** A point this close to a building's outline (in degrees, about 2 m) still counts. */
	const TOLERANCE = 0.00002;
	/** Grid cell for looking up points near a building (about 55 m). */
	const CELL = 0.0005;
	const THROTTLE_MS = 200;

	type SplitProperties = { match: boolean; height: number; base: number };
	type SplitBuildings = FeatureCollection<Polygon, SplitProperties>;
	const NO_SPLIT: SplitBuildings = { type: 'FeatureCollection', features: [] };

	/** Rise from the ground between zoom 15 and 16.5, so flying in feels like arriving. */
	const rising = (value: unknown) => ['interpolate', ['linear'], ['zoom'], 15, 0, 16.5, value];

	const mapCtx = getMapContext();
	/** Whether the base map has 3D buildings to colour. */
	let ready = $state(false);
	/** The base layer's own filter, kept when we add ours. */
	let baseFilter: FilterSpecification | undefined;
	let split: SplitBuildings = $state.raw(NO_SPLIT);

	// Once the map exists: waitForStyleLoaded ignores calls made before that.
	$effect(() => {
		if (!mapCtx.map) return;
		mapCtx.waitForStyleLoaded((map) => {
			if (!map.getLayer(BASE_LAYER)) return;
			// The base style writes `["!has", "hide_3d"]` in the legacy syntax, which can't be
			// combined with expressions; this is the same filter as an expression.
			baseFilter = map.getFilter(BASE_LAYER) ? ['!', ['has', 'hide_3d']] : undefined;
			map.setPaintProperty(BASE_LAYER, 'fill-extrusion-color', [
				'case',
				['boolean', ['feature-state', 'match'], false],
				MATCH_COLOR,
				OTHER_COLOR
			]);
			map.setPaintProperty(BASE_LAYER, 'fill-extrusion-opacity', 0.85);
			map.setPaintProperty(
				BASE_LAYER,
				'fill-extrusion-height',
				rising(['coalesce', ['get', 'render_height'], 10]) as never
			);
			map.setPaintProperty(
				BASE_LAYER,
				'fill-extrusion-base',
				rising(['coalesce', ['get', 'render_min_height'], 0]) as never
			);
			ready = true;
		});
	});

	type Grid = Map<string, Position[]>;

	function gridOf(features: PostalPoints['features']): Grid {
		const grid: Grid = new Map();
		for (const f of features) {
			const p = f.geometry.coordinates;
			const key = `${Math.floor(p[0] / CELL)},${Math.floor(p[1] / CELL)}`;
			if (!grid.has(key)) grid.set(key, []);
			grid.get(key)!.push(p);
		}
		return grid;
	}

	function insideRing(p: Position, ring: Position[]): boolean {
		let inside = false;
		for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
			const [xi, yi] = ring[i];
			const [xj, yj] = ring[j];
			if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) {
				inside = !inside;
			}
		}
		return inside;
	}

	function nearRing(p: Position, ring: Position[]): boolean {
		for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
			const [ax, ay] = ring[j];
			const [bx, by] = ring[i];
			const dx = bx - ax;
			const dy = by - ay;
			const len = dx * dx + dy * dy;
			const t = len ? Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / len)) : 0;
			const ex = ax + t * dx - p[0];
			const ey = ay + t * dy - p[1];
			if (ex * ex + ey * ey < TOLERANCE * TOLERANCE) return true;
		}
		return false;
	}

	/** Whether a shown point is inside (or right next to) a polygon's outer ring. */
	function holdsPoint(ring: Position[], grid: Grid): boolean {
		let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
		for (const [x, y] of ring) {
			if (x < minX) minX = x;
			if (x > maxX) maxX = x;
			if (y < minY) minY = y;
			if (y > maxY) maxY = y;
		}
		minX -= TOLERANCE;
		minY -= TOLERANCE;
		maxX += TOLERANCE;
		maxY += TOLERANCE;
		for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++) {
			for (let cy = Math.floor(minY / CELL); cy <= Math.floor(maxY / CELL); cy++) {
				for (const p of grid.get(`${cx},${cy}`) ?? []) {
					if (p[0] < minX || p[0] > maxX || p[1] < minY || p[1] > maxY) continue;
					if (insideRing(p, ring) || nearRing(p, ring)) return true;
				}
			}
		}
		return false;
	}

	type Box = [west: number, south: number, east: number, north: number];

	function boxOf(ring: Position[]): Box {
		const box: Box = [Infinity, Infinity, -Infinity, -Infinity];
		for (const [x, y] of ring) {
			if (x < box[0]) box[0] = x;
			if (y < box[1]) box[1] = y;
			if (x > box[2]) box[2] = x;
			if (y > box[3]) box[3] = y;
		}
		return box;
	}

	/** Whether two boxes overlap by at least half of the smaller one. */
	function mostlyOverlap(a: Box, b: Box): boolean {
		const w = Math.min(a[2], b[2]) - Math.max(a[0], b[0]);
		const h = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
		if (w <= 0 || h <= 0) return false;
		const area = (box: Box) => (box[2] - box[0]) * (box[3] - box[1]);
		return w * h >= 0.5 * Math.min(area(a), area(b));
	}

	/** A building's polygons (each as rings, outer first). */
	function polygonsOf(f: MapGeoJSONFeature): Position[][][] {
		const g = f.geometry;
		if (g.type === 'Polygon') return [g.coordinates];
		if (g.type === 'MultiPolygon') return g.coordinates;
		return [];
	}

	/** Building ids coloured through feature state. */
	let matched = new Set<string | number>();
	/** Building ids left out of the base layer and drawn as `split`. */
	let splitKey = '';

	function setMatched(map: MaplibreMap, next: Set<string | number>) {
		for (const id of matched) {
			if (!next.has(id)) map.removeFeatureState({ source: SOURCE, sourceLayer: SOURCE_LAYER, id });
		}
		for (const id of next) {
			if (!matched.has(id)) {
				map.setFeatureState({ source: SOURCE, sourceLayer: SOURCE_LAYER, id }, { match: true });
			}
		}
		matched = next;
	}

	function setSplit(map: MaplibreMap, ids: (string | number)[], features: SplitBuildings) {
		split = features;
		const key = ids.join(',');
		if (key === splitKey) return;
		splitKey = key;
		const leaveOut: FilterSpecification = ['!', ['in', ['id'], ['literal', ids]]];
		map.setFilter(
			BASE_LAYER,
			ids.length === 0
				? (baseFilter ?? null)
				: baseFilter
					? (['all', baseFilter, leaveOut] as FilterSpecification)
					: leaveOut
		);
	}

	function clear(map: MaplibreMap) {
		setMatched(map, new Set());
		setSplit(map, [], NO_SPLIT);
	}

	$effect(() => {
		const map = mapCtx.map;
		const features = points?.features ?? [];
		if (!map || !ready) return;
		if (!active || features.length === 0) {
			clear(map);
			return;
		}
		const grid = gridOf(features);

		const update = () => {
			if (map.getZoom() < MIN_ZOOM) return;
			// A building cut by tile edges comes back once per tile; check every piece.
			const buildings = map.querySourceFeatures(SOURCE, { sourceLayer: SOURCE_LAYER });
			const whole = new Set<string | number>();
			const splitIds = new Set<string | number>();
			for (const f of buildings) {
				if (f.id === undefined) continue;
				const polygons = polygonsOf(f);
				const hits = polygons.filter((rings) => holdsPoint(rings[0], grid)).length;
				if (hits === 0) continue;
				if (polygons.length > 1 && hits < polygons.length) splitIds.add(f.id);
				else whole.add(f.id);
			}
			for (const id of splitIds) whole.delete(id);

			// Tiles overlap a little, so the same polygon can come back from two tiles, whole or
			// clipped. Draw each once, and colour overlapping copies alike, or they flicker.
			const parts: (Feature<Polygon, SplitProperties> & { box: Box })[] = [];
			const drawn = new Set<string>();
			for (const f of buildings) {
				if (f.id === undefined || !splitIds.has(f.id)) continue;
				for (const rings of polygonsOf(f)) {
					const box = boxOf(rings[0]);
					const key = box.map((v) => v.toFixed(6)).join();
					if (drawn.has(key)) continue;
					drawn.add(key);
					parts.push({
						type: 'Feature',
						box,
						properties: {
							match: holdsPoint(rings[0], grid),
							height: Number(f.properties.render_height ?? 10),
							base: Number(f.properties.render_min_height ?? 0)
						},
						geometry: { type: 'Polygon', coordinates: rings }
					});
				}
			}
			const hits = parts.filter((p) => p.properties.match);
			for (const p of parts) {
				if (!p.properties.match && hits.some((h) => mostlyOverlap(h.box, p.box))) {
					p.properties.match = true;
				}
			}
			setMatched(map, whole);
			setSplit(map, [...splitIds], {
				type: 'FeatureCollection',
				features: parts.map(({ type, properties, geometry }) => ({ type, properties, geometry }))
			});
		};

		let timer: ReturnType<typeof setTimeout> | undefined;
		const schedule = () => {
			timer ??= setTimeout(() => {
				timer = undefined;
				update();
			}, THROTTLE_MS);
		};
		const onData = (e: MapSourceDataEvent) => {
			if (e.sourceId === SOURCE && e.tile) schedule();
		};
		map.on('sourcedata', onData);
		map.on('moveend', schedule);
		update();
		return () => {
			clearTimeout(timer);
			map.off('sourcedata', onData);
			map.off('moveend', schedule);
		};
	});
</script>

<GeoJSONSource id="building-split" data={split}>
	<FillExtrusionLayer
		id={LAYER.buildingSplit}
		minzoom={14.5}
		paint={{
			'fill-extrusion-color': ['case', ['get', 'match'], MATCH_COLOR, OTHER_COLOR],
			'fill-extrusion-height': rising(['get', 'height']) as never,
			'fill-extrusion-base': rising(['get', 'base']) as never,
			'fill-extrusion-opacity': 0.85
		}}
	/>
</GeoJSONSource>

<GeoJSONSource id="building-points" data={points ?? NO_POINTS}>
	<SymbolLayer
		id={LAYER.buildingLabels}
		minzoom={15}
		paint={{
			'text-color': '#000',
			'text-halo-color': '#fff',
			'text-halo-width': 2
		}}
		layout={{
			'text-font': ['Roboto Bold', 'Noto Sans Bold'],
			'text-field': ['get', 'ADDRESS'],
			'text-size': ['interpolate', ['linear'], ['zoom'], 16, 11, 18, 14, 20, 16],
			'text-max-width': 9,
			'text-variable-anchor': ['bottom', 'left', 'right', 'top'],
			'text-radial-offset': 1,
			'text-allow-overlap': false
		}}
	/>
</GeoJSONSource>
