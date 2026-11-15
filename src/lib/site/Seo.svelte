<!--
	Title, description and link-preview tags for one page.
	Every Story and the Front Page render exactly one of these.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { absoluteUrl, site } from './config';

	interface Props {
		/** Page title without the Publication name; omit on the Front Page. */
		title?: string;
		description: string;
		/** Path or absolute URL of the preview image. */
		image?: string;
		type?: 'website' | 'article';
		/** ISO date the Story was published (articles only). */
		published?: string;
	}

	let { title, description, image = site.defaultImage, type = 'website', published }: Props =
		$props();

	const fullTitle = $derived(title ? `${title} | ${site.shortName}` : site.name);
	const canonical = $derived(absoluteUrl(page.url.pathname));
	const imageUrl = $derived(absoluteUrl(image));
</script>

<svelte:head>
	<title>{fullTitle}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonical} />
	<meta property="og:site_name" content={site.name} />
	<meta property="og:locale" content={site.locale} />
	<meta property="og:title" content={fullTitle} />
	<meta property="og:description" content={description} />
	<meta property="og:image" content={imageUrl} />
	<meta property="og:url" content={canonical} />
	<meta property="og:type" content={type} />
	{#if type === 'article' && published}
		<meta property="article:published_time" content={published} />
	{/if}
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>
