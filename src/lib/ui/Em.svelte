<!-- Highlighted text on a solid colour, with black or white text, whichever reads better. -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** Background colour as hex: `#rgb` or `#rrggbb`. */
		color?: string;
		nowrap?: boolean;
		children?: Snippet;
	}

	let { color = '#d3d3d3', nowrap = true, children }: Props = $props();

	function textColor(hex: string): string {
		let digits = hex.replace('#', '');
		if (digits.length === 3) digits = [...digits].map((d) => d + d).join('');
		const [r, g, b] = [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16));
		if ([r, g, b].some(Number.isNaN)) return 'black';
		const brightness = (r * 299 + g * 587 + b * 114) / 1000;
		return brightness > 125 ? 'black' : 'white';
	}

	const text = $derived(textColor(color));
</script>

<span class="em" class:nowrap style:background-color={color} style:color={text}>
	{@render children?.()}
</span>

<style>
	.em {
		padding: 1px 4px 1px 4px;
		font-weight: bold;
	}
	.nowrap {
		white-space: nowrap;
	}
</style>
