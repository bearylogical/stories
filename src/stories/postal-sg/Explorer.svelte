<!--
	The Explorer: the reader types the start of a postal code and the map shows where those
	codes are. It drives the Stage through its Step's View (`bind:view`), like any other Step.
-->
<script lang="ts">
	import Em from '$lib/ui/Em.svelte';
	import { postal, type PostalResult } from './postal-data.svelte';
	import { EXPLORER_START, explorerView, type PostalView } from './views';

	interface Props {
		/** The View this Explorer asks for; bind it to the Explorer's Step. */
		view?: PostalView;
	}

	let { view = $bindable(EXPLORER_START) }: Props = $props();

	let value = $state('');
	/** The digits being shown, once `value` has settled. */
	let digits = $state('');
	let result: PostalResult | undefined = $state.raw();
	let lastFound: string | undefined = $state();

	const valid = $derived(/^\d{0,6}$/.test(value));
	const count = $derived(result?.count ?? postal.total);

	let timer: ReturnType<typeof setTimeout> | undefined;
	function oninput() {
		clearTimeout(timer);
		timer = setTimeout(() => {
			if (valid) digits = value;
		}, 300);
	}

	$effect(() => {
		const typed = digits;
		if (typed === '') {
			// All of them: no need to wait for the points (or to load them early).
			result = undefined;
			view = EXPLORER_START;
			return;
		}
		let live = true;
		postal
			.query(`${typed}*`)
			.then((found) => {
				if (!live) return;
				result = found;
				// Nothing found: leave the map where it was.
				if (found.count === 0) return;
				lastFound = found.features.features[0]?.properties.POSTAL;
				view = explorerView(typed, found);
			})
			.catch(() => {});
		return () => {
			live = false;
			clearTimeout(timer);
		};
	});
</script>

<div class="explorer">
	<h3>Postal Code Explorer</h3>
	<label>
		<span class="sr-only">Postal code</span>
		<input
			type="text"
			inputmode="numeric"
			placeholder="Enter a 6 digit postal code"
			bind:value
			{oninput}
		/>
	</label>

	{#if !valid && value.length > 6 && /^\d+$/.test(value)}
		<p class="error">Postal codes have only 6 digits.</p>
	{:else if !valid}
		<p class="error">Please enter only digits.</p>
	{:else if result?.count === 0}
		<p class="error">
			Can't find that postal code, try removing entries{#if lastFound}{' '}or try {lastFound}{/if}.
		</p>
	{/if}

	<p aria-live="polite">
		<Em color="#206095">{count ?? '…'}</Em> Postal Codes are currently shown.
	</p>
</div>

<style>
	h3 {
		margin: 0 0 15px;
		font-size: 1.5rem;
	}
	input {
		width: 100%;
		margin: 0 0 0.5em;
		padding: 0.4em;
		border: 1px solid #ccc;
		border-radius: 2px;
		font: inherit;
	}
	p {
		margin: 5px 0 0;
	}
	.error {
		color: red;
		font-size: 0.9em;
		font-style: italic;
	}
</style>
