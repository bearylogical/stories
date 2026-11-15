<!--
	One Step of a Scrolly. It declares the View the Stage shows while the Step is active.

	- `scrub`: the Stage gets `progress` 0→1 as the reader scrolls through this Step.
	- `onenter`: escape hatch for things a View can't say; prefer Views (docs/adr/0002).
-->
<script lang="ts" generics="V">
	// eslint-plugin-svelte 2 does not see `generics`; TypeScript checks `V`.
	/* eslint-disable no-undef */
	import type { Snippet } from 'svelte';
	import { getScrollyContext, setStepContext, type Direction } from './context';

	interface Props {
		view: V;
		scrub?: boolean;
		onenter?: (direction: Direction) => void;
		children?: Snippet;
	}

	let { view, scrub = false, onenter, children }: Props = $props();

	let element: HTMLElement | undefined = $state();

	const scrolly = getScrollyContext<V>();
	const index = scrolly.register({
		get view() {
			return view;
		},
		get scrub() {
			return scrub;
		},
		get onenter() {
			return onenter;
		},
		get element() {
			return element;
		}
	});

	const active = $derived(scrolly.active === index);

	setStepContext({
		get active() {
			return active;
		},
		get progress() {
			return index < scrolly.active ? 1 : index > scrolly.active ? 0 : scrolly.progress;
		}
	});
</script>

<div class="step" class:scrub data-active={active ? '' : undefined} bind:this={element}>
	{#if children}
		<div class="step-card">
			{@render children()}
		</div>
	{/if}
</div>

<style>
	.step {
		display: flex;
		align-items: center;
		min-height: 100vh;
	}
	/* A Scrub Step lasts longer, so there is room to scroll through it. */
	.step.scrub {
		align-items: flex-start;
		min-height: 200vh;
	}
	/* …and its text stays in view while the reader scrubs. */
	.step.scrub .step-card {
		position: sticky;
		top: 40vh;
	}
	.step:first-child {
		padding-top: 50vh;
	}
	.step:last-child {
		padding-bottom: 50vh;
	}

	.step-card {
		width: var(--step-width);
		margin-inline: auto;
		padding: 1rem 1.25rem;
		border: var(--border-brutal) solid var(--color-ink);
		background: color-mix(in srgb, var(--color-paper) 92%, transparent);
		box-shadow: var(--shadow-brutal);
		pointer-events: auto;
	}
	.step-card > :global(:first-child) {
		margin-top: 0;
	}
	.step-card > :global(:last-child) {
		margin-bottom: 0;
	}

	@media (min-width: 48rem) {
		:global(.scrolly[data-layout='sidecar']) .step-card {
			border-color: transparent;
			background: none;
			box-shadow: none;
		}
		/* Dim inactive Steps only once the Scrolly runs; without JavaScript all stay readable. */
		:global(.scrolly[data-layout='sidecar'][data-ready]) .step:not([data-active]) .step-card {
			opacity: 0.35;
		}
	}
	@media (prefers-reduced-motion: no-preference) {
		.step-card {
			transition: opacity 0.3s ease;
		}
	}
</style>
