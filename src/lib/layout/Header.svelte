<!--
	The Publication's slim header, on the Front Page and every Story: the Publication's name
	(with its publisher, small) linking back to the Front Page, and the RSS feed. It scrolls away with the page, so a
	Scrolly's pinned Stage always has the whole screen.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { site } from '$lib/site/config';

	const onFrontPage = $derived(page.url.pathname === '/');
</script>

<header class="site-header">
	<a href="/" class="brand" aria-current={onFrontPage ? 'page' : undefined}>
		<span class="wordmark">{site.name}</span>
		<span class="publisher">by {site.publisher}</span>
	</a>
	<nav aria-label="Publication">
		{#if !onFrontPage}
			<a href="/">All Stories</a>
		{/if}
		<a href="/rss.xml">RSS</a>
	</nav>
</header>

<style>
	.site-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		height: var(--header-height);
		padding-inline: 1rem;
		border-bottom: var(--border-brutal-thick) solid var(--color-ink);
		background: var(--color-paper);
	}

	a {
		color: var(--color-ink);
		text-decoration: none;
	}

	.brand {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		white-space: nowrap;
	}
	.wordmark {
		font-size: 1.5rem;
		font-weight: var(--font-weight-black);
		letter-spacing: var(--tracking-brutal-tight);
		line-height: 1;
	}
	.publisher {
		color: var(--color-muted);
		font-size: 0.75rem;
	}

	nav {
		display: flex;
		gap: 1.25rem;
		font-size: 0.8125rem;
		font-weight: var(--font-weight-black);
		letter-spacing: var(--tracking-brutal);
		text-transform: uppercase;
		white-space: nowrap;
	}

	nav a:hover,
	.brand:hover .wordmark {
		color: var(--color-accent-text);
	}

	@media (min-width: 48rem) {
		.site-header {
			padding-inline: 2rem;
		}
	}
</style>
