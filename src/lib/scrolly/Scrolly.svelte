<!--
	A Scrolly: a Stage pinned with GSAP ScrollTrigger while the reader scrolls its Steps past.

	```svelte
	<Scrolly layout="sidecar">
		{#snippet stage(view, progress)}
			<MapStage {view} {progress} style={…}>…layers…</MapStage>
		{/snippet}
		<Step view={{ camera: { zoom: 11 } }}>Text…</Step>
		<Step view={…} scrub>Text…</Step>
	</Scrolly>
	```

	- Overlay: Steps scroll as cards over a full-screen Stage.
	- Sidecar: Steps beside the Stage; below 48rem wide it falls back to Overlay (CSS only).
	- Step text is plain prerendered HTML, so it reads without JavaScript.
	- With `prefers-reduced-motion`, Scrub is off: the Stage gets `progress = 1`.
-->
<script lang="ts" generics="V">
	// eslint-plugin-svelte 2 does not see `generics`; TypeScript checks `V`.
	/* eslint-disable no-undef */
	import { onMount, type Snippet } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import { gsap } from 'gsap';
	import { ScrollTrigger } from 'gsap/ScrollTrigger';
	import { setScrollyContext, type StepEntry } from './context';
	import type { ScrollyLayout } from './types';

	interface Props {
		layout?: ScrollyLayout;
		/** Renders the Stage for the active Step's View (see the Stage contract in ./types). */
		stage: Snippet<[view: V, progress: number]>;
		/** The Steps. */
		children: Snippet;
		/** Accessible name of the Stage, e.g. "Map of Singapore". */
		label?: string;
	}

	let { layout = 'overlay', stage, children, label }: Props = $props();

	const steps: StepEntry<V>[] = $state([]);
	let active = $state(0);
	let scrubProgress = $state(0);

	const current = $derived(steps[active]);
	const progress = $derived(current?.scrub && !prefersReducedMotion.current ? scrubProgress : 1);

	setScrollyContext<V>({
		register(step) {
			return steps.push(step) - 1;
		},
		get active() {
			return active;
		},
		get progress() {
			return progress;
		}
	});

	let ready = $state(false);
	let root: HTMLElement;
	let stageEl: HTMLElement;

	onMount(() => {
		gsap.registerPlugin(ScrollTrigger);

		const ctx = gsap.context(() => {
			// Pin the Stage for the whole Scrolly; the Steps keep their own space.
			ScrollTrigger.create({
				trigger: root,
				start: 'top top',
				end: 'bottom bottom',
				pin: stageEl,
				pinSpacing: false
			});

			steps.forEach((step, index) => {
				if (!step.element) return;
				// A Step is active while it crosses the middle of the viewport.
				ScrollTrigger.create({
					trigger: step.element,
					start: 'top center',
					end: 'bottom center',
					onToggle(self) {
						if (!self.isActive) return;
						const scrub = steps[index].scrub;
						if (scrub) scrubProgress = self.progress;
						active = index;
						steps[index].onenter?.(self.direction === 1 ? 'forward' : 'backward');
					},
					onUpdate(self) {
						if (active === index && steps[index].scrub) scrubProgress = self.progress;
					}
				});
			});
		}, root);

		ready = true;
		return () => ctx.revert();
	});
</script>

<section class="scrolly" data-layout={layout} data-ready={ready ? '' : undefined} bind:this={root}>
	<div class="stage-column">
		<div class="stage" bind:this={stageEl} role={label ? 'figure' : undefined} aria-label={label}>
			{#if current}
				{@render stage(current.view, progress)}
			{/if}
		</div>
	</div>
	<div class="steps">
		{@render children()}
	</div>
</section>

<style>
	.scrolly {
		position: relative;
		width: 100%;
		/* Steps line up with the Story's text column. */
		--step-width: min(32rem, 100% - 2rem);
	}

	.stage-column {
		height: 100vh;
	}
	.stage {
		width: 100%;
		height: 100vh;
		overflow: hidden;
	}

	/* Overlay (and Sidecar on narrow screens): Steps scroll over the full-screen Stage. */
	.steps {
		position: relative;
		z-index: 1;
		margin-top: -100vh;
		/* Let the Stage take pointer input between the Step cards. */
		pointer-events: none;
	}

	@media (min-width: 48rem) {
		.scrolly[data-layout='sidecar'] {
			display: grid;
			grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
			--step-width: min(28rem, 100% - 3rem);
		}
		.scrolly[data-layout='sidecar'] .stage-column {
			grid-column: 2;
			grid-row: 1;
		}
		.scrolly[data-layout='sidecar'] .steps {
			grid-column: 1;
			grid-row: 1;
			margin-top: 0;
		}
	}
</style>
