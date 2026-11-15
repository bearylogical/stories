<script lang="ts">
	import Seo from '$lib/site/Seo.svelte';
	import DraftBanner from '$lib/stories/DraftBanner.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const story = $derived(data.story);
	const Body = $derived(data.component);

	const formatDate = (iso: string) =>
		new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-SG', {
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			timeZone: 'UTC'
		});
</script>

<Seo
	title={story.title}
	description={story.summary}
	image={story.image}
	type="article"
	published={story.published}
/>

{#if story.status === 'draft'}
	<DraftBanner />
{/if}

<article class="story">
	<header class="story-header">
		<h1>{story.title}</h1>
		<p class="story-byline">
			<time datetime={story.published}>{formatDate(story.published)}</time>
			{#if story.updated}
				· updated <time datetime={story.updated}>{formatDate(story.updated)}</time>
			{/if}
			// bearylogical
		</p>
		<p class="story-summary">{story.summary}</p>
	</header>

	<div class="story-body">
		<Body />
	</div>

	{#if story.sources?.length}
		<footer class="story-sources">
			<h2>Sources</h2>
			<ol>
				{#each story.sources as source (source.href)}
					<li><a href={source.href}>{source.label}</a></li>
				{/each}
			</ol>
		</footer>
	{/if}
</article>
