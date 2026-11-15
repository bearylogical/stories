#!/usr/bin/env node
// pnpm check:story <slug> [options]
//
// Scrolls a Story to each of its Steps in a real browser and saves a screenshot of each,
// for comparing two versions side by side by eye (map tiles differ slightly between
// renders, so this is not a pass/fail test). It also reports how many bytes the page had
// downloaded before the reader reached the first Step (phase 2's 3 MB budget).
//
// Options:
//   --label <name>     folder for this run's screenshots (default: "current")
//   --url <base>       site to test (default: http://localhost:4173). If nothing answers
//                      there, the script runs `vite preview` itself (building first if
//                      there is no build/). R2's CORS rules allow localhost:4173 and :5173.
//   --steps <css>      selector for the Steps (default: ".scrolly .step")
//   --viewport <WxH>   browser size (default: 1280x800)
//   --settle <ms>      wait after each scroll for the Stage to finish moving (default: 6000)
//   --out <dir>        where to write (default: .story-check)
//
// Writes <out>/<slug>/<label>/NN.png and <out>/<slug>/compare.html, which shows every
// label's screenshots side by side, one row per Step.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';

const { values: opts, positionals } = parseArgs({
	allowPositionals: true,
	options: {
		label: { type: 'string', default: 'current' },
		url: { type: 'string', default: 'http://localhost:4173' },
		steps: { type: 'string', default: '.scrolly .step' },
		viewport: { type: 'string', default: '1280x800' },
		settle: { type: 'string', default: '6000' },
		out: { type: 'string', default: '.story-check' }
	}
});

const slug = positionals[0];
if (!slug) {
	console.error('Usage: pnpm check:story <slug> [--label name] [--url base] [--steps css]');
	process.exit(1);
}
const [width, height] = opts.viewport.split('x').map(Number);
const settle = Number(opts.settle);
const storyDir = resolve(opts.out, slug);
const runDir = join(storyDir, opts.label);

const mb = (bytes) => `${(bytes / 1e6).toFixed(2)} MB`;

async function reachable(url) {
	try {
		return (await fetch(url, { method: 'HEAD' })).status < 500;
	} catch {
		return false;
	}
}

function run(cmd, args) {
	return new Promise((ok, fail) => {
		const child = spawn(cmd, args, { stdio: 'inherit' });
		child.on('exit', (code) => (code === 0 ? ok() : fail(new Error(`${cmd} exited ${code}`))));
	});
}

/** Starts `vite preview` on the --url's port unless something is already serving it. */
async function ensureServer(base) {
	if (await reachable(base)) return undefined;
	if (!existsSync('build')) await run('pnpm', ['exec', 'vite', 'build']);
	const port = new URL(base).port || '4173';
	const child = spawn('pnpm', ['exec', 'vite', 'preview', '--port', port, '--strictPort'], {
		stdio: 'ignore',
		detached: true // its own process group, so it can be stopped with vite's own process
	});
	for (let i = 0; i < 60 && !(await reachable(base)); i++)
		await new Promise((r) => setTimeout(r, 500));
	if (!(await reachable(base))) throw new Error(`vite preview did not start on ${base}`);
	return child;
}

async function main() {
	const base = opts.url.replace(/\/$/, '');
	const server = await ensureServer(base);
	const browser = await chromium.launch({
		args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
	});
	try {
		const page = await browser.newPage({ viewport: { width, height } });

		// Count bytes on the wire (compressed), cache disabled, like the DevTools check.
		// Playwright also reports the requests a page's workers make.
		const cdp = await page.context().newCDPSession(page);
		await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
		let bytes = 0;
		page.context().on('requestfinished', async (request) => {
			const sizes = await request.sizes().catch(() => undefined);
			if (sizes) bytes += sizes.responseBodySize + sizes.responseHeadersSize;
		});
		page.on('pageerror', (err) => console.warn(`  page error: ${err.message}`));

		const url = `${base}/${slug}/`;
		console.log(`${url} → ${runDir}`);
		await page.goto(url, { waitUntil: 'load' });
		await page.waitForSelector(opts.steps, { state: 'attached', timeout: 90_000 });
		await page.waitForTimeout(settle);
		const beforeFirstStep = bytes;

		await rm(runDir, { recursive: true, force: true });
		await mkdir(runDir, { recursive: true });

		const count = await page.locator(opts.steps).count();
		for (let i = 0; i < count; i++) {
			// Bring the Step's text (its first child, if it has one) to the middle of the
			// viewport, where Steps become active.
			await page.evaluate(
				({ selector, i }) => {
					const step = document.querySelectorAll(selector)[i];
					const anchor = step.firstElementChild ?? step;
					const box = anchor.getBoundingClientRect();
					window.scrollTo(0, window.scrollY + box.top + box.height / 2 - innerHeight / 2);
				},
				{ selector: opts.steps, i }
			);
			await page.waitForTimeout(settle);
			const file = join(runDir, `${String(i + 1).padStart(2, '0')}.png`);
			await page.screenshot({ path: file });
			console.log(`  Step ${i + 1}/${count}: ${file} (${mb(bytes)} so far)`);
		}

		// The end of the Story, past the last Step (e.g. an Explorer).
		await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
		await page.waitForTimeout(settle);
		await page.screenshot({ path: join(runDir, `${String(count + 1).padStart(2, '0')}-end.png`) });

		const summary = `Downloaded before the first Step: ${mb(beforeFirstStep)} (budget 3 MB)`;
		console.log(summary);
		await writeFile(join(runDir, 'summary.txt'), `${summary}\nSteps: ${count}\n`);
	} finally {
		await browser.close();
		if (server?.pid) process.kill(-server.pid);
	}
	await writeCompare();
}

/** One row per screenshot, one column per label. */
async function writeCompare() {
	const labels = (await readdir(storyDir, { withFileTypes: true }))
		.filter((d) => d.isDirectory())
		.map((d) => d.name)
		.sort();
	const shots = new Map(
		await Promise.all(
			labels.map(async (l) => [
				l,
				(await readdir(join(storyDir, l))).filter((f) => f.endsWith('.png'))
			])
		)
	);
	const names = [...new Set([...shots.values()].flat())].sort();
	const rows = names
		.map(
			(name) =>
				`<tr><th>${name}</th>${labels
					.map((l) => `<td>${shots.get(l).includes(name) ? `<img src="${l}/${name}">` : ''}</td>`)
					.join('')}</tr>`
		)
		.join('\n');
	const html = `<!doctype html><meta charset="utf-8"><title>${slug}: Step screenshots</title>
<style>body{font:14px system-ui;margin:1rem}table{border-collapse:collapse}td,th{padding:4px;vertical-align:top}img{width:100%;max-width:640px;border:1px solid #ccc}</style>
<table><tr><th></th>${labels.map((l) => `<th>${l}</th>`).join('')}</tr>
${rows}</table>`;
	await writeFile(join(storyDir, 'compare.html'), html);
	console.log(`Side by side: ${join(storyDir, 'compare.html')}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
