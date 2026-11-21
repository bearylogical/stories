<!--
	postal-sg's Stage: the map and its layers. Loaded with a dynamic import from index.svx, so
	the Story's text (prerendered) doesn't wait for MapLibre.

	The one place that works out what a PostalView means (./stage-spec.ts): it fetches the
	View's points, filters the layers, moves the Sweep and turns the buildings on.
-->
<script lang="ts">
	import { MapStage } from '$lib/stages';
	import { streetsStyle } from '$lib/styles';
	import { STREETS_BUILDINGS } from './layer-ids';
	import PostalLayers from './PostalLayers.svelte';
	import { postal } from './postal-data.svelte';
	import {
		postalMapView,
		showsBuildings,
		sweepAt,
		sweepPoints,
		type Selection
	} from './stage-spec';
	import { getSweepContext } from './sweep.svelte';
	import type { PostalView } from './views';

	interface Props {
		view: PostalView;
		progress: number;
	}

	let { view, progress }: Props = $props();

	/** The View's points, with addresses when there are few enough. */
	let selection: Selection | null = $state.raw(null);

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
				if (live) selection = { pattern, points: result.features };
			})
			.catch(() => {});
		return () => {
			live = false;
		};
	});

	const sweep = $derived(sweepPoints(view, selection));
	const at = $derived(sweepAt(view, selection, progress));
	// A string, so the map's View only changes when the Sweep reaches a new code, not on
	// every scroll frame.
	const sweepCode = $derived(at?.properties.POSTAL);
	const mapView = $derived(postalMapView(view, sweepCode));

	const cursor = getSweepContext();
	$effect(() => {
		if (at) cursor.at = at.properties;
	});
</script>

<MapStage view={mapView} {progress} style={streetsStyle} duration={2400}>
	<PostalLayers
		selection={selection?.points ?? null}
		{sweep}
		buildings={showsBuildings(view)}
		base={STREETS_BUILDINGS}
	/>
</MapStage>
