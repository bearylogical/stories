import { publishedStories } from '$lib/stories';
import { absoluteUrl, site } from '$lib/site/config';
import type { RequestHandler } from './$types';

// The Publication's feed: published Stories only, even in a build that includes Drafts.
export const prerender = true;

const escape = (text: string) =>
	text.replace(
		/[<>&'"]/g,
		(c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!
	);

const rfc822 = (iso: string) => new Date(`${iso}T00:00:00Z`).toUTCString();

export const GET: RequestHandler = () => {
	const items = publishedStories.map((story) => {
		const url = absoluteUrl(`/${story.slug}/`);
		return `
		<item>
			<title>${escape(story.title)}</title>
			<link>${url}</link>
			<guid isPermaLink="true">${url}</guid>
			<pubDate>${rfc822(story.published)}</pubDate>
			<description>${escape(story.summary)}</description>
		</item>`;
	});

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
	<channel>
		<title>${escape(site.fullName)}</title>
		<link>${absoluteUrl('/')}</link>
		<description>${escape(site.description)}</description>
		<language>en-sg</language>
		<atom:link href="${absoluteUrl('/rss.xml')}" rel="self" type="application/rss+xml" />${items.join('')}
	</channel>
</rss>
`;

	return new Response(xml, {
		headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' }
	});
};
