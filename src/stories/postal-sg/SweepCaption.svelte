<!--
	The code and address the Sweep has reached, inside the Sweep's Step. Uses the same rule as
	PostalLayers (progress × number of points), so the caption and the map agree.
-->
<script lang="ts">
	import { getStepContext } from '$lib/scrolly';
	import { postal, type PostalPoints } from './postal-data.svelte';

	interface Props {
		pattern: string;
	}

	let { pattern }: Props = $props();

	const step = getStepContext();
	let points: PostalPoints | null = $state.raw(null);

	$effect(() => {
		if (!step.active || points) return;
		postal
			.query(pattern)
			.then((result) => (points = result.features))
			.catch(() => {});
	});

	const current = $derived.by(() => {
		const features = points?.features ?? [];
		if (features.length === 0) return undefined;
		const index = Math.min(features.length - 1, Math.floor(step.progress * features.length));
		return features[index].properties;
	});
</script>

<p class="sweep" aria-live="off">
	{#if current}
		<strong>{current.POSTAL}</strong>
		<span>{current.ADDRESS ?? ''}</span>
	{:else}
		<strong>546000</strong> <span>…</span>
	{/if}
</p>

<style>
	.sweep {
		display: flex;
		gap: 0.6em;
		align-items: baseline;
		min-height: 2.6em;
		font-variant-numeric: tabular-nums;
	}
	strong {
		font-size: 1.4em;
	}
</style>
