<!--
	The code and address the Sweep has reached, inside the Sweep's Step. The Stage works it out
	(`sweepAt` in ./stage-spec.ts) and shares it through the Story's Sweep context, so the
	caption and the map agree.
-->
<script lang="ts">
	import { getSweepContext } from './sweep.svelte';

	const cursor = getSweepContext();
	const current = $derived(cursor.at);
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
