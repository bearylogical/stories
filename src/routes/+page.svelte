<!--
	The Front Page: a one-line introduction, the newest Story featured large, and the rest
	newest first. The Story list decides what is here: Drafts only in dev and PR previews.
-->
<script lang="ts">
	import Seo from '$lib/site/Seo.svelte';
	import { site } from '$lib/site/config';
	import { formatDate } from '$lib/stories/format';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const featured = $derived(data.stories[0]);
	const rest = $derived(data.stories.slice(1));
</script>

<Seo description={site.description} image={site.defaultImage} />

<div class="front-page">
	<h1 class="intro">{site.description}</h1>

	{#if featured}
		<article class="featured brutalist-card">
			<a href="/{featured.slug}/" class="card-link">
				<img
					src={featured.image}
					alt=""
					width="1200"
					height="630"
					fetchpriority="high"
					class="featured-image"
				/>
				<div class="featured-text">
					<p class="meta">
						{#if featured.status === 'draft'}<span class="draft">Draft</span>{/if}
						<time datetime={featured.published}>{formatDate(featured.published)}</time>
					</p>
					<h2>{featured.title}</h2>
					<p class="summary">{featured.summary}</p>
					<span class="brutalist-button">Read the Story</span>
				</div>
			</a>
		</article>
	{:else}
		<p class="empty">The first Story is on its way.</p>
	{/if}

	{#if rest.length}
		<h2 class="section-title">More Stories</h2>
		<ul class="story-list">
			{#each rest as story (story.slug)}
				<li>
					<article>
						<a href="/{story.slug}/" class="card-link">
							<img src={story.image} alt="" width="1200" height="630" loading="lazy" />
							<div>
								<p class="meta">
									{#if story.status === 'draft'}<span class="draft">Draft</span>{/if}
									<time datetime={story.published}>{formatDate(story.published)}</time>
								</p>
								<h3>{story.title}</h3>
								<p class="summary">{story.summary}</p>
							</div>
						</a>
					</article>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.front-page {
		width: min(1100px, 100% - 2rem);
		margin: 0 auto;
		padding-block: 2rem 4rem;
	}

	.intro {
		max-width: 40rem;
		margin-bottom: 2rem;
		font-size: clamp(1.5rem, 4vw, 2.25rem);
		font-weight: var(--font-weight-black);
		letter-spacing: var(--tracking-brutal-tight);
		line-height: 1.15;
	}

	.card-link {
		display: block;
		color: inherit;
		text-decoration: none;
	}

	img {
		display: block;
		width: 100%;
		aspect-ratio: 1200 / 630;
		object-fit: cover;
		border: var(--border-brutal) solid var(--color-ink);
		background: var(--color-rule);
	}

	.featured {
		padding: 1rem;
	}
	.featured .card-link {
		display: grid;
		gap: 1.5rem;
	}
	.featured h2 {
		margin-block: 0.25rem 0.75rem;
		font-size: clamp(1.75rem, 5vw, 3rem);
		font-weight: var(--font-weight-black);
		letter-spacing: var(--tracking-brutal-tight);
		line-height: 1.05;
	}
	.featured .summary {
		margin-bottom: 1.5rem;
		font-size: 1.125rem;
	}

	.meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--color-muted);
		font-size: 0.875rem;
	}
	.draft {
		padding: 0.1rem 0.4rem;
		background: var(--color-accent);
		color: var(--color-ink);
		font-size: 0.75rem;
		font-weight: var(--font-weight-black);
		letter-spacing: var(--tracking-brutal);
		text-transform: uppercase;
	}

	.section-title {
		margin-block: 3rem 1.25rem;
		padding-bottom: 0.5rem;
		border-bottom: var(--border-brutal-thick) solid var(--color-ink);
		font-size: 0.875rem;
		font-weight: var(--font-weight-black);
		letter-spacing: var(--tracking-brutal);
		text-transform: uppercase;
	}

	.story-list {
		display: grid;
		gap: 2rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.story-list .card-link {
		display: grid;
		grid-template-columns: minmax(7rem, 1fr) 2fr;
		gap: 1rem;
		align-items: start;
	}
	.story-list h3 {
		margin-block: 0.25rem 0.5rem;
		font-size: 1.25rem;
		font-weight: var(--font-weight-black);
		line-height: 1.2;
	}
	.story-list .card-link:hover h3 {
		color: var(--color-accent-text);
	}

	.empty {
		color: var(--color-muted);
		font-size: 1.25rem;
	}

	@media (min-width: 48rem) {
		.featured {
			padding: 1.5rem;
		}
		.featured .card-link {
			grid-template-columns: 3fr 2fr;
			align-items: center;
		}
		.story-list {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
