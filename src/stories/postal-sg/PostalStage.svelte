<!--
	postal-sg's Stage: the map and its layers. Loaded with a dynamic import from index.svx, so
	the Story's text (prerendered) doesn't wait for MapLibre.
-->
<script lang="ts">
	import { MapStage } from '$lib/stages';
	import { streetsStyle } from '$lib/styles';
	import PostalLayers from './PostalLayers.svelte';
	import { withPattern, type PostalView } from './views';

	interface Props {
		view: PostalView;
		progress: number;
	}

	let { view, progress }: Props = $props();

	const mapView = $derived(withPattern(view));
</script>

<MapStage view={mapView} {progress} style={streetsStyle} duration={2400}>
	<PostalLayers {view} {progress} />
</MapStage>
