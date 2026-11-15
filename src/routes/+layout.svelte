<script lang="ts">
	import { setContext } from 'svelte';
	import Header from '$lib/layout/Header.svelte';
	import { themes } from '$lib/config';
	import { absoluteUrl, site } from '$lib/site/config';
	import './../app.css';

	interface Props {
		children?: import('svelte').Snippet;
	}

	let { children }: Props = $props();

	// STYLE CONFIG
	// Set theme globally (options are 'light' or 'dark')
	const theme = 'light';
	setContext('theme', themes[theme]);
</script>

<svelte:head>
	<link
		rel="alternate"
		type="application/rss+xml"
		title={site.name}
		href={absoluteUrl('/rss.xml')}
	/>
</svelte:head>

<Header />

<main>
	{@render children?.()}
</main>
