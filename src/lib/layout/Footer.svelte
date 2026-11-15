<!--
	The Publication's footer, on the Front Page and every Story: who publishes it, and the same
	ways in as the header, so every page has a proper end.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { site } from '$lib/site/config';

	const onFrontPage = $derived(page.url.pathname === '/');
</script>

<footer class="site-footer">
	<div class="inner">
		<p class="colophon">
			<a href="/" class="wordmark">{site.name}</a>
			<span>by {site.publisher}</span>
		</p>
		<nav aria-label="Publication footer">
			{#if !onFrontPage}
				<a href="/">All Stories</a>
			{/if}
			<a href="/rss.xml">RSS</a>
			<a href="https://github.com/bearylogical/stories">Source</a>
		</nav>
	</div>
</footer>

<style>
	.site-footer {
		position: relative;
		z-index: 1;
		border-top: var(--border-brutal-thick) solid var(--color-ink);
		background: var(--color-paper);
	}

	.inner {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		width: min(1100px, 100% - 2rem);
		margin: 0 auto;
		padding-block: 2rem;
	}

	.colophon {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		color: var(--color-muted);
		font-size: 0.875rem;
	}

	a {
		color: var(--color-ink);
		text-decoration: none;
	}
	a:hover {
		color: var(--color-accent-text);
	}

	.wordmark {
		font-size: 1.5rem;
		font-weight: var(--font-weight-black);
		letter-spacing: var(--tracking-brutal-tight);
		line-height: 1;
	}

	nav {
		display: flex;
		gap: 1.25rem;
		font-size: 0.8125rem;
		font-weight: var(--font-weight-black);
		letter-spacing: var(--tracking-brutal);
		text-transform: uppercase;
	}
</style>
