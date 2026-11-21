#!/usr/bin/env node
// pnpm new-story [--title …] [--slug …] [--summary …] [--stage map|custom]
//                [--layout overlay|sidecar] [--steps N] [--data a.csv,b.geojson] [--yes]
//
// Starts a new Story as a Draft: writes src/stories/<slug>/index.svx (plus a Stage and a
// Story Data file when asked for) and creates data/<slug>/ for its Source Data.
//
// Every question has a flag. Questions answered by a flag are not asked. With --yes, the
// rest take their defaults (only --title has none), so it runs without a terminal.

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import * as p from '@clack/prompts';
import {
	SLUG_RULE,
	draftFrontmatter,
	frontmatterBlock,
	isSlug,
	parseFrontmatter,
	slugify
} from '../src/lib/stories/story-rules.js';
import { keyOf } from './lib/data-keys.js';

const root = resolve(import.meta.dirname, '..');

const DATA_NAME = /^[a-z0-9][a-z0-9-]*\.[a-z0-9]+$/;

const STAGES = /** @type {const} */ (['map', 'custom']);
const LAYOUTS = /** @type {const} */ (['overlay', 'sidecar']);

const { values: flags } = parseArgs({
	options: {
		title: { type: 'string' },
		slug: { type: 'string' },
		summary: { type: 'string' },
		stage: { type: 'string' },
		layout: { type: 'string' },
		steps: { type: 'string' },
		data: { type: 'string' },
		yes: { type: 'boolean', short: 'y', default: false },
		help: { type: 'boolean', short: 'h', default: false }
	}
});

if (flags.help) {
	console.log(`usage: pnpm new-story [options]

  --title <text>              The Story's title
  --slug <slug>               Its permanent URL name (default: made from the title)
  --summary <text>            One or two sentences for the Front Page and link previews
  --stage map|custom          Stage kind (default: map)
  --layout overlay|sidecar    Scrolly layout (default: overlay)
  --steps <n>                 Number of starter Steps (default: 3)
  --data <a.csv,b.geojson>    Story Data file names, comma-separated (default: none)
  --yes, -y                   Don't ask; use defaults for anything not given`);
	process.exit(0);
}

// --- Checks, shared by flags and prompts. Each returns an error message or undefined. ---

const checks = {
	title: (v) => (!v?.trim() ? 'A title is required.' : undefined),
	slug: (v) => {
		if (!isSlug(v)) return `Use ${SLUG_RULE}.`;
		if (existsSync(join(root, 'src/stories', v))) return `src/stories/${v}/ already exists.`;
	},
	summary: (v) => (!v?.trim() ? 'A summary is required (it shows on the Front Page).' : undefined),
	stage: (v) => (STAGES.includes(v) ? undefined : `Stage must be one of: ${STAGES.join(', ')}.`),
	layout: (v) =>
		LAYOUTS.includes(v) ? undefined : `Layout must be one of: ${LAYOUTS.join(', ')}.`,
	steps: (v) => {
		const n = Number(v);
		return Number.isInteger(n) && n >= 1 && n <= 20
			? undefined
			: 'Steps must be a whole number from 1 to 20.';
	},
	data: (v) => {
		const bad = parseDataNames(v).filter((name) => !DATA_NAME.test(name));
		if (bad.length) return `Not a file name like counts.csv: ${bad.join(', ')}`;
		const stems = parseDataNames(v).map((name) => keyOf(name));
		if (new Set(stems).size !== stems.length) return 'Two files have the same name.';
	}
};

function parseDataNames(value) {
	return (value ?? '')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
}

/** `counts.csv` → `counts.v1.csv`, the first published version. */
const versioned = (name) => name.replace(/(\.[a-z0-9]+)$/, '.v1$1');

// --- Asking ---

const interactive = process.stdin.isTTY && process.stdout.isTTY;

function fail(message) {
	if (interactive) p.cancel(message);
	else console.error(`error: ${message}`);
	process.exit(1);
}

function guard(value) {
	if (p.isCancel(value)) fail('Cancelled. Nothing was written.');
	return value;
}

/**
 * One answer: from its flag if given (checked), else its default under --yes, else a prompt.
 * @param {keyof typeof checks} key
 * @param {{ fallback?: string, ask: () => Promise<unknown> }} how
 */
async function answer(key, { fallback, ask }) {
	const flag = flags[key];
	if (flag !== undefined) {
		const problem = checks[key](flag);
		if (problem) fail(`--${key}: ${problem}`);
		return flag;
	}
	if (flags.yes || !interactive) {
		if (fallback === undefined)
			fail(`--${key} is required${interactive ? ' with --yes' : ' (no terminal to ask in)'}.`);
		const problem = checks[key](fallback);
		if (problem) fail(`--${key}: ${problem}`);
		return fallback;
	}
	return guard(await ask());
}

if (interactive) p.intro('New Story');

const title = (
	await answer('title', {
		ask: () =>
			p.text({
				message: 'Title',
				placeholder: 'Where Singapore’s trees grow',
				validate: checks.title
			})
	})
).trim();

const suggested = slugify(title);
const slug = await answer('slug', {
	fallback: suggested,
	ask: () =>
		p.text({
			message: 'Slug (the permanent URL name; it never changes once published)',
			initialValue: suggested,
			validate: checks.slug
		})
});

const summary = (
	await answer('summary', {
		ask: () =>
			p.text({
				message: 'Summary (one or two sentences for the Front Page and link previews)',
				validate: checks.summary
			})
	})
).trim();

const stage = await answer('stage', {
	fallback: 'map',
	ask: () =>
		p.select({
			message: 'Stage kind',
			options: [
				{ value: 'map', label: 'Map', hint: 'MapStage with a MapLibre base map' },
				{ value: 'custom', label: 'Custom', hint: 'your own Svelte component in the Story folder' }
			]
		})
});

const layout = await answer('layout', {
	fallback: 'overlay',
	ask: () =>
		p.select({
			message: 'Scrolly layout',
			options: [
				{
					value: 'overlay',
					label: 'Overlay',
					hint: 'Steps scroll as cards over a full-screen Stage'
				},
				{ value: 'sidecar', label: 'Sidecar', hint: 'Steps beside the Stage' }
			]
		})
});

const steps = Number(
	await answer('steps', {
		fallback: '3',
		ask: () =>
			p.text({ message: 'Number of starter Steps', initialValue: '3', validate: checks.steps })
	})
);

const dataNames = parseDataNames(
	await answer('data', {
		fallback: '',
		ask: () =>
			p.text({
				message: 'Story Data file names, comma-separated (optional)',
				placeholder: 'counts.csv, areas.geojson',
				defaultValue: '',
				validate: checks.data
			})
	})
);

// --- Writing ---

const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local time
const meta = draftFrontmatter({ title, summary, published: today });
try {
	parseFrontmatter(slug, meta); // the reader's own check, so a new Draft never breaks the build
} catch (error) {
	fail(/** @type {Error} */ (error).message);
}
const files = dataNames.map((name) => ({ name, key: keyOf(name), published: versioned(name) }));
const geojson = files.find((f) => f.name.endsWith('.geojson'));

function storySource() {
	const imports = ["\timport { Scrolly, Step } from '$lib/scrolly';"];
	if (stage === 'map') {
		imports.push(
			"\timport { MapStage } from '$lib/stages';",
			"\timport { streetsStyle } from '$lib/styles';"
		);
		if (geojson) imports.push("\timport { CircleLayer, GeoJSONSource } from 'svelte-maplibre-gl';");
	} else {
		imports.push("\timport Stage from './Stage.svelte';");
	}
	if (files.length) imports.push("\timport { urls } from './data';");

	const stageMarkup =
		stage === 'map'
			? geojson
				? `<MapStage {view} {progress} style={streetsStyle}>
<GeoJSONSource id="${geojson.key}" data={urls.${geojson.key}}>
<CircleLayer id="${geojson.key}-points" paint={{ 'circle-radius': 5, 'circle-color': '#ff6b35' }} />
</GeoJSONSource>
</MapStage>`
				: `<MapStage {view} {progress} style={streetsStyle}>
<!-- Add the Story's sources and layers here. Give every layer an id; Views decide which show. -->
</MapStage>`
			: '<Stage {view} {progress} />';

	const viewOf = (i) =>
		stage === 'map'
			? `{{ camera: { center: [103.82, 1.35], zoom: ${(10.5 + i * 0.5).toFixed(1)} } }}`
			: `{{ step: ${i + 1} }}`;

	const stepMarkup = Array.from(
		{ length: steps },
		(_, i) => `<Step view=${viewOf(i)}>

Step ${i + 1}. Write what the reader should notice here.

</Step>`
	).join('\n\n');

	const dataNote = files.length
		? `\n\t// Story Data: ${files.map((f) => `urls.${f.key}`).join(', ')} (see ./data.ts).`
		: '';

	return `${frontmatterBlock(meta)}
<script lang="ts">
${imports.join('\n')}${dataNote}
</script>

An opening paragraph or two. Markdown works here; see \`src/stories/_example/index.svx\` for every part of a Story.

<Scrolly layout="${layout}" label="${stage === 'map' ? 'Map' : 'Chart'}">
{#snippet stage(view, progress)}
${stageMarkup}
{/snippet}

${stepMarkup}
</Scrolly>

## After the Scrolly

More text, or an Explorer.
`;
}

const customStage = `<!--
	This Story's Stage. It follows the Stage contract (docs/adr/0002): it takes the active Step's
	\`view\` and a Scrub \`progress\` (0–1), and must be able to show any View directly.
-->
<script lang="ts" module>
	export interface View {
		step: number;
	}
</script>

<script lang="ts">
	import type { StageProps } from '$lib/scrolly';

	let { view, progress }: StageProps<View> = $props();
</script>

<figure class="stage">
	<p>View {view.step} <small>(progress {progress.toFixed(2)})</small></p>
</figure>

<style>
	.stage {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		margin: 0;
		background: var(--color-canvas);
		font-size: 2rem;
		font-weight: var(--font-weight-black);
	}
</style>
`;

const dataSource = () => `// Story Data for ${slug} (docs/adr/0003).
//
// Put each file in data/${slug}/ under the name below, then run \`pnpm data:publish ${slug}\`.
// A published file never changes: to change one, add it as the next version (e.g. .v2.)
// and update its name here. Set VITE_DATA_HOST to test files before publishing.
import { storyDataUrl } from '$lib/data/story-data';

const SLUG = '${slug}';

export const urls = {
${files.map((f) => `\t${f.key}: storyDataUrl(SLUG, '${f.published}')`).join(',\n')}
};
`;

const storyDir = join(root, 'src/stories', slug);
const dataDir = join(root, 'data', slug);
const written = [];

await mkdir(storyDir, { recursive: true });
await writeFile(join(storyDir, 'index.svx'), storySource());
written.push(`src/stories/${slug}/index.svx`);
if (stage === 'custom') {
	await writeFile(join(storyDir, 'Stage.svelte'), customStage);
	written.push(`src/stories/${slug}/Stage.svelte`);
}
if (files.length) {
	await writeFile(join(storyDir, 'data.ts'), dataSource());
	written.push(`src/stories/${slug}/data.ts`);
}
await mkdir(dataDir, { recursive: true });
written.push(`data/${slug}/ (git-ignored, for Source Data)`);

const next = [
	`Wrote:\n${written.map((w) => `  ${w}`).join('\n')}`,
	files.length
		? `Story Data: put ${files.map((f) => f.published).join(', ')} in data/${slug}/, then run pnpm data:publish ${slug}`
		: undefined,
	`Run pnpm dev and open http://localhost:5173/${slug}/`
]
	.filter(Boolean)
	.join('\n\n');

if (interactive) {
	p.note(next, `${title} (Draft)`);
	p.outro('Happy writing.');
} else {
	console.log(next);
}
