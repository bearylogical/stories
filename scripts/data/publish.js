#!/usr/bin/env node
// pnpm data:publish <slug> [--dry-run] [--bucket <name>]
//
// Builds a Story's Story Data from its Source Data in data/<slug>/ and uploads
// it to R2 as <slug>/<name>.v<N>.<ext> with the `cf` CLI (docs/adr/0003).
//
// Published files never change. Before uploading anything, this lists what is
// already in the bucket under <slug>/:
//   - same name, same content (MD5 = R2 ETag): skipped
//   - same name, different content: the whole publish stops; bump the version
//   - new name: uploaded
//
// A Story whose Source Data needs processing has a build script at
// scripts/data/<slug>/build.js that exports `build({ sourceDir, outDir })`.
// Without one, the files in data/<slug>/ that already have versioned names
// (<name>.v<N>.<ext>) are published as they are.

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isVersionedName, storyDataKey } from '../../src/lib/data/story-data.js';
import { SLUG_RULE, isSlug } from '../../src/lib/stories/story-rules.js';

const run = promisify(execFile);

const DEFAULT_BUCKET = 'bearylogical-stories-data'; // served at data.bearylogical.net

function usage(message) {
	if (message) console.error(`error: ${message}\n`);
	console.error('usage: pnpm data:publish <slug> [--dry-run] [--bucket <name>]');
	process.exit(1);
}

function parseArgs(argv) {
	const args = { slug: undefined, dryRun: false, bucket: process.env.STORY_DATA_BUCKET || DEFAULT_BUCKET };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--dry-run') args.dryRun = true;
		else if (a === '--bucket') args.bucket = argv[++i];
		else if (a.startsWith('--bucket=')) args.bucket = a.slice('--bucket='.length);
		else if (a.startsWith('-')) usage(`unknown option ${a}`);
		else if (!args.slug) args.slug = a;
		else usage(`unexpected argument ${a}`);
	}
	if (!args.slug) usage('missing <slug>');
	if (!isSlug(args.slug)) usage(`not a Slug (${SLUG_RULE}): ${args.slug}`);
	if (!args.bucket) usage('missing bucket name');
	return args;
}

const CF = process.env.CF_BIN || 'cf';

const CONTENT_TYPES = {
	'.json': 'application/json',
	'.geojson': 'application/geo+json',
	'.csv': 'text/csv; charset=utf-8',
	'.tsv': 'text/tab-separated-values; charset=utf-8',
	'.txt': 'text/plain; charset=utf-8',
	'.topojson': 'application/json',
	'.pmtiles': 'application/vnd.pmtiles',
	'.parquet': 'application/vnd.apache.parquet',
	'.arrow': 'application/vnd.apache.arrow.file',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.webp': 'image/webp',
	'.svg': 'image/svg+xml'
};

/** The default build: copy the already-versioned files in data/<slug>/ as they are. */
async function copyVersioned({ sourceDir, outDir }) {
	const entries = await readdir(sourceDir, { withFileTypes: true });
	const names = entries.filter((e) => e.isFile() && isVersionedName(e.name)).map((e) => e.name);
	if (names.length === 0) {
		throw new Error(`No files with versioned names (<name>.v<N>.<ext>) in ${sourceDir}`);
	}
	for (const name of names) await copyFile(join(sourceDir, name), join(outDir, name));
	return names.map((name) => ({
		name,
		contentType: CONTENT_TYPES[extname(name)] ?? 'application/octet-stream'
	}));
}

/** Runs cf and returns { stdout, stderr }. */
async function cf(args) {
	try {
		return await run(CF, args, { maxBuffer: 64 * 1024 * 1024 });
	} catch (error) {
		if (error.code === 'ENOENT') {
			throw new Error(
				'The `cf` CLI was not found. Install it with `npm install --global cf` (needs Node 22.18+), then `cf auth login`.'
			);
		}
		throw new Error(`cf ${args.join(' ')} failed:\n${error.stderr || error.message}`);
	}
}

/**
 * All objects under a prefix, as a Map of key → etag. `cf r2 objects list`
 * prints the objects as a JSON array on stdout and the paging info as a
 * `result_info: {...}` line on stderr.
 */
async function listRemote(bucket, prefix) {
	const objects = new Map();
	let cursor;
	do {
		const args = ['r2', 'objects', 'list', '--bucket-name', bucket, '--prefix', prefix, '--per-page', '1000'];
		if (cursor) args.push('--cursor', cursor);
		const { stdout, stderr } = await cf(args);
		for (const o of JSON.parse(stdout)) objects.set(o.key, String(o.etag ?? '').replaceAll('"', ''));
		const info = stderr.match(/^result_info: (\{.*\})$/m);
		const page = info ? JSON.parse(info[1]) : {};
		cursor = page.is_truncated ? page.cursor : undefined;
	} while (cursor);
	return objects;
}

function md5(buffer) {
	return createHash('md5').update(buffer).digest('hex');
}

function formatBytes(n) {
	return n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`;
}

async function main() {
	const { slug, dryRun, bucket } = parseArgs(process.argv.slice(2));
	const root = resolve(import.meta.dirname, '../..');
	const sourceDir = join(root, 'data', slug);
	const outDir = join(sourceDir, 'dist');
	const buildScript = join(root, 'scripts', 'data', slug, 'build.js');

	if (!existsSync(sourceDir)) usage(`no Source Data at data/${slug}/ (it is git-ignored; copy it in first)`);

	await rm(outDir, { recursive: true, force: true });
	await mkdir(outDir, { recursive: true });
	const { build } = existsSync(buildScript)
		? await import(pathToFileURL(buildScript).href)
		: { build: copyVersioned };
	const built = await build({ sourceDir, outDir });

	const bad = built.filter((f) => !isVersionedName(f.name));
	if (bad.length) throw new Error(`Not versioned names (<name>.v<N>.<ext>): ${bad.map((f) => f.name).join(', ')}`);

	const remote = await listRemote(bucket, `${slug}/`);

	const plan = [];
	const conflicts = [];
	for (const file of built) {
		const path = join(outDir, file.name);
		const key = storyDataKey(slug, file.name);
		const hash = md5(await readFile(path));
		const size = (await stat(path)).size;
		const existing = remote.get(key);
		if (existing === undefined) plan.push({ ...file, key, path, size, action: 'upload' });
		else if (existing === hash) plan.push({ ...file, key, path, size, action: 'unchanged' });
		else conflicts.push(key);
	}

	if (conflicts.length) {
		console.error(
			`Refusing to publish: these files already exist in ${bucket} with different content.\n` +
				`Published files never change; bump the version in the Story's data config instead.\n  ` +
				conflicts.join('\n  ')
		);
		process.exit(1);
	}

	const uploads = plan.filter((p) => p.action === 'upload');
	const total = uploads.reduce((s, p) => s + p.size, 0);
	console.log(
		`${bucket}/${slug}/: ${uploads.length} to upload (${formatBytes(total)}), ${plan.length - uploads.length} unchanged`
	);
	for (const p of uploads) console.log(`  + ${p.key}  ${formatBytes(p.size)}  ${p.contentType}`);

	if (dryRun) {
		console.log('Dry run: nothing uploaded.');
		return;
	}

	for (const p of uploads) {
		await cf([
			'r2', 'objects', 'put', p.key,
			'--bucket-name', bucket,
			'--file', p.path,
			'--content-type', p.contentType
		]);
		console.log(`  uploaded ${p.key}`);
	}
	console.log('Done.');
}

main().catch((error) => {
	console.error(error.message);
	process.exit(1);
});
