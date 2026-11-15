<script lang="ts">
	import Seo from '$lib/site/Seo.svelte';
</script>

<!-- Placeholder until the Front Page is built from the Story list (phase 5). -->
<Seo description="Visual stories, each exploring a different dataset." />

<div class="container">
	<h1 class="brutalist-heading text-6xl">Under Construction</h1>
	<p>This page is currently under construction. Please check back later.</p>
	<a class="brutalist-button mt-6" href="/postal-sg/">Read: Topography of Singapore Postal Codes</a>
</div>

<style>
	.container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 70vh;
		text-align: center;
	}

	h1 {
		margin-bottom: 1rem;
	}

	p {
		color: var(--color-muted);
		font-size: 1.25rem;
	}
</style>
