<!--
	A tiny custom Stage: bars that highlight one category and can grow with Scrub.
	It follows the Stage contract (`view` + `progress`) and reaches any View directly.
-->
<script lang="ts" module>
	export interface BarView {
		/** Category to highlight. */
		highlight?: string;
		/** Grow the bars from zero with the Step's Scrub progress. */
		grow?: boolean;
	}
</script>

<script lang="ts">
	import type { StageProps } from '$lib/scrolly';

	interface Props extends StageProps<BarView> {
		data: { label: string; value: number }[];
	}

	let { view, progress, data }: Props = $props();

	const max = $derived(Math.max(...data.map((d) => d.value)));
	const scale = $derived(view.grow ? progress : 1);
</script>

<figure class="bars">
	{#each data as d (d.label)}
		<div class="bar" class:highlight={view.highlight === d.label}>
			<div class="fill" style:height="{(d.value / max) * scale * 100}%"></div>
			<span class="label">{d.label}</span>
		</div>
	{/each}
</figure>

<style>
	.bars {
		display: flex;
		gap: 1rem;
		align-items: flex-end;
		height: 100%;
		margin: 0;
		padding: 15vh 2rem 4rem;
		background: var(--color-canvas);
	}
	.bar {
		position: relative;
		flex: 1;
		height: 100%;
		display: flex;
		align-items: flex-end;
	}
	.fill {
		width: 100%;
		border: var(--border-brutal) solid var(--color-ink);
		background: var(--color-rule);
	}
	.highlight .fill {
		background: var(--color-accent);
	}
	.label {
		position: absolute;
		top: 100%;
		width: 100%;
		padding-top: 0.5rem;
		font-size: 0.875rem;
		text-align: center;
	}
	@media (prefers-reduced-motion: no-preference) {
		.fill {
			transition: background-color 0.3s ease;
		}
	}
</style>
