<script lang="ts">
	import Footer from '$lib/layout/Footer.svelte';
	import Header from '$lib/layout/Header.svelte';
	import { absoluteUrl, site } from '$lib/site/config';
	import './../app.css';

	interface Props {
		children?: import('svelte').Snippet;
	}

	let { children }: Props = $props();
</script>

<svelte:head>
	<link
		rel="alternate"
		type="application/rss+xml"
		title={site.fullName}
		href={absoluteUrl('/rss.xml')}
	/>
</svelte:head>

<Header />

<main>
	{@render children?.()}
</main>

<Footer />
