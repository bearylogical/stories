# Roadmap: turning the repo into a publishing setup

This turns the repo from one hand-built Story into a **Publication**: Stories written in mdsvex, Scrollys driven by GSAP, Story Data on R2, and a static build on Coolify.

- **Vocabulary:** [CONTEXT.md](../CONTEXT.md). Use these terms (Story, Scrolly, Stage, Step, View, Scrub, Draft, Front Page, Story Data…) in code and in conversation.
- **Decisions:** [docs/adr/](adr/). Read them before changing anything they cover.
- **Order:** phases run in order, and each one ends in something that can be deployed. Phase 2 can run alongside phase 3 because they don't touch the same files.

## Status

| Phase | Status | Where |
| --- | --- | --- |
| 1. Base | Done (two Coolify variable tidy-ups left) | bearylogical/stories#1, bearylogical/stories#2 |
| 2. Data | Not started | n/a |
| 3. Scrollytelling | In progress (PR open; preview DNS left) | bearylogical/stories#5 |
| 4. postal-sg rebuild | Not started (needs 2 and 3) | n/a |
| 5. The rest | Not started (needs 3) | n/a |

Update this table when a phase starts, opens a PR, or merges.

## Starting a phase in a new session

Open a session in this repo and say:

> Read `docs/ROADMAP.md`, `CONTEXT.md` and `docs/adr/`. Then do phase N. Branch from `main`, keep to the phase's scope, and open a PR. Update the Status table in the roadmap as part of the PR.

---

## Phase 1: Base

**Goal:** one branch, a static build, a clean dependency list, a shared theme.

**Done in PR #1:**
- Rebuilt the branch from `prod`, which was 11 commits ahead of `main` (Svelte 5, workers, landing page), and merged `main` back in.
- `adapter-static` with `prerender = true` and `trailingSlash: 'always'` in `src/routes/+layout.ts`. Each page is written as `<slug>/index.html`, so `/postal-sg/index.html` works again.
- `src/lib/site/`: `config.ts` (Publication name, URL, `absoluteUrl()`) and `Seo.svelte` (title, canonical URL, link-preview tags).
- Tailwind 4 through Vite only. `src/lib/styles/{theme,story,brutalist}.css` hold the tokens, shared Story layout and brutalist components. No hard-coded colours.
- Removed `svelte-maplibre`, deck.gl, `simplex-noise`, changesets, Tailwind 3 and PostCSS, and the Node and auto adapters.
- `vite.config.ts` sets an inline empty PostCSS config. Without it, Vite picks up a stray `postcss.config.*` from a parent directory, which happens in worktrees.
- Fixed: district centres were fetched from `/src/assets/…` (404 in production). They're now an `?url` import.

**Coolify switch (done 2026-11-15):** `stories-frontend` (uuid `rokg0ww004g0gck4o0wsosgw`) builds `main` with Railpack in static mode (Nixpacks is deprecated): build command `pnpm build`, publish directory `/build`, `nginx:alpine` on port 80, no start command, and the custom nginx config with `try_files $uri $uri.html $uri/index.html …`. `/`, `/postal-sg`, `/postal-sg/` and `/postal-sg/index.html` all return 200.

`prod` was deleted on GitHub on 2026-11-15; its last commit, `438938a`, is in `main`.

**Still to do:** in Coolify, delete the preview `ONE_MAP_API_KEY`, and untick **Runtime** on both `PUBLIC_MAPTILER_KEY` entries (build only).

**Tailwind Preflight is off:** `src/app.css` loads Tailwind 4's theme and utilities, but not Preflight (its CSS reset). On `prod`, Tailwind 3's reset never ran, so Stories were styled by browser defaults for headings, lists, links and spacing. Turning the reset on in PR #1 removed the postal-sg headline styling, list numbers and link styles. Phase 3 adds deliberate Story typography; it can turn Preflight back on then.

**Known debt (left on purpose, fixed in phases 3–4):** `pnpm check` reports about 100 type errors in `Scroller.svelte`, `postal-sg/+page.svelte`, the workers, `loader.js` and `utils.js`. All of them were already on `prod`.

---

## Phase 2: Data

**Goal:** postal-sg's first load drops from a 72 MB GeoJSON to under 3 MB, and data publishing can be repeated the same way each time. See [ADR 0003](adr/0003-story-data-on-r2-per-slug-immutable.md) and [ADR 0005](adr/0005-postal-sg-ships-compact-binary-not-geojson.md).

**Facts found while planning:**
- A deploy takes about 3 minutes, but `vite build` takes about 6 seconds of that. The rest is Railpack cloning the repo, copying it into the Docker build, running `pnpm i` (823 packages) from scratch, and pulling `nginx:alpine`. The Railpack image build is about 2½ minutes; the rollout is about 20 seconds.
- `https://data.bearylogical.net/singpostcode.geojson` is 72,655,205 bytes, served from R2 through Cloudflare with no `cache-control` (`cf-cache-status: DYNAMIC`), compressed with Brotli.
- R2's CORS rules block `http://localhost:*` (seen in testing), so local builds can't load data. PR previews are probably blocked too.
- Files live at the bucket root (no per-Slug folders).
- Source Data and scripts are in `scripts/` and `src/assets/`; about 210 MB of raw GeoJSON is committed to git.

**Scope:**
1. **Layout:** move to `data.bearylogical.net/<slug>/<name>.v<N>.<ext>`. Keep the old root files until the live site no longer uses them.
2. **Binary format:** a build script writes the postal points as a packed binary file: a short header, then for each point a `Uint32` postal code and `Float32` longitude and latitude (about 12 bytes per point).
   - Address text goes into separate files per sector (first two digits), fetched only when zoomed into buildings or in the Explorer.
   - Update `src/lib/workers/postal-worker.js` to read the new format.
3. **Publish script:** `pnpm data:publish <slug>` builds Story Data from `data/<slug>/` (Source Data) and uploads it with the `cf` CLI (the global CLAUDE.md says to use `cf`, since the repo has no Wrangler config).
   - It refuses to overwrite a file that already exists, because published files never change.
4. **Cloudflare:**
   - A cache rule on `data.bearylogical.net` with Cache Everything and an edge TTL of a year. Uploaded objects get `Cache-Control: public, max-age=31536000, immutable`.
   - R2 CORS allows `http://localhost:5173`, `http://localhost:4173` and the Coolify preview pattern `https://*.stories.bearylogical.net`.
5. **Repo hygiene:** move Source Data from `src/assets/` to `data/<slug>/`, which is git-ignored (or in LFS). Keep only small derived files that the app imports.
6. Point the **current** postal-sg page at the new files, so readers get faster loading before phase 4.
7. **Build time:** cut a deploy from about 3 minutes to under 1.
   - Moving Source Data out of `src/assets/` (item 5) removes about 219 MB that every deploy clones and copies into the Docker build. The app imports only `singapore_districts_centers.geojson` from there.
   - Add a `.dockerignore` (or the Railpack equivalent; check that Coolify's Railpack build honours it) that leaves out `data/`, `scripts/`, `docs/` and `build/`.
   - Move script-only packages (`cheerio`, `axios`, `dotenv`) out of the app's install, e.g. into a `scripts/package.json` workspace, so `pnpm i` installs less on every deploy.
   - Pin the static image to a version (e.g. `nginx:1.29-alpine`) so Coolify doesn't pull `latest` on every deploy.
   - Turn on Coolify's debug logs for one deploy to get timings per step, before and after.

**Done when:** postal-sg downloads under 3 MB before the first Step (check the DevTools network panel, cache disabled), works on localhost, the publish script uploads a new versioned file, and a deploy takes under 1 minute.

---

## Phase 3: Scrollytelling

**Goal:** a Story can be written as mdsvex text with a declarative Scrolly. See [ADR 0002](adr/0002-declarative-views-on-gsap-scrolltrigger.md) and [ADR 0004](adr/0004-stories-live-in-a-content-folder-not-routes.md).

**Scope:**
1. **mdsvex:** add mdsvex (`.svx`), with Svelte 5 runes inside Stories.
2. **Content folder:** each Story is `src/stories/<slug>/index.svx`, alongside its own components. One route `src/routes/[slug]/` with:
   - `+page.ts` loads the Story through `import.meta.glob`.
   - `entries()` returns the Slugs to prerender.
   - A shared `src/lib/stories/index.ts` exports the Story list (frontmatter plus Slug), sorted by `published`. The Front Page, RSS and `entries()` all use it.
3. **Frontmatter:** checked at build time (a build error, not a runtime one):
   - `title`, `published`, `summary`, `image` and `status` (`draft` | `published`) are required.
   - `updated` and `sources` (list of `{ label, href }`) are optional.
   - The Slug comes from the folder name.
4. **Drafts:** an `includeDrafts` setting.
   - On in `vite dev`. Off in `pnpm build` unless `PUBLIC_INCLUDE_DRAFTS=true`.
   - Add `pnpm build:drafts` and `pnpm preview:drafts`.
   - Set `PUBLIC_INCLUDE_DRAFTS=true` as a **preview-only** variable in Coolify, and turn on PR previews.
   - Drafts show a "Draft" banner and are left out of the Front Page and RSS in production.
5. **Components** in `src/lib/scrolly/`:
   - `<Scrolly layout="overlay|sidecar">`: pins the Stage with GSAP ScrollTrigger. Sidecar falls back to Overlay on narrow screens.
   - `<Step view={…} scrub?>`: declares a View, and optionally `onenter` as an escape hatch. With `scrub`, the Stage gets `progress` from 0 to 1.
   - **Stage contract:** any component that takes `view` and `progress` props. It has to be able to reach any View directly, because readers can jump straight to a Step.
6. **MapStage** in `src/lib/stages/MapStage.svelte`:
   - Uses `svelte-maplibre-gl`.
   - Its View covers camera (center, zoom, pitch, bearing), visible layers and filters.
   - Each Story provides its own layers as children or snippets.
7. **Accessibility:**
   - All Step text is prerendered and readable without JavaScript.
   - With `prefers-reduced-motion`, the Stage jumps straight to each View and Scrub is turned off.
8. **Clean up:** delete the ONS `Scroller.svelte` once nothing imports it (in phase 4 at the latest).
9. **Story typography:** style Story text (headings, paragraphs, lists, links, the byline) in `src/lib/styles/story.css`, then turn Tailwind's Preflight back on in `src/app.css`. Check postal-sg still looks the same.

**Done when:** a small sample Story in `src/stories/_example/` (always a Draft) shows Overlay and Sidecar, a Scrub Step and a MapStage, and type-checks cleanly.

**Done in bearylogical/stories#5:**
- `svelte.config.js` adds mdsvex for `.svx`. Runes work inside Stories (the sample uses `$derived`).
- `src/lib/stories/`: the Story list (`allStories`, `stories`, `publishedStories`, `getStory`, `loadStoryComponent`) and `frontmatter.ts`, which throws one error listing every problem. It runs while prerendering, so a bad Story fails `pnpm build`. Slugs starting with `_` are samples and must stay Drafts.
- `includeDrafts` is the compile-time constant `__INCLUDE_DRAFTS__`, set in `vite.config.ts`: on for `vite dev`, otherwise only with `PUBLIC_INCLUDE_DRAFTS=true`. `pnpm build:drafts` and `pnpm preview:drafts` set it.
- `src/routes/[slug]/` renders the title, byline, summary, Story body and sources, with `DraftBanner` on Drafts. While no Story is published, the route isn't prerendered (SvelteKit 2.22 fails a build on a prerenderable route with no entries); `404.html` covers it.
- `src/lib/scrolly/`: `Scrolly`, `Step` and the `StageProps` contract. Steps become active as they cross the middle of the viewport. Scrub Steps are twice as tall and their card stays in view. Inactive Sidecar Steps are dimmed only once JavaScript runs.
- `src/lib/stages/MapStage.svelte`: a `MapView` has `camera`, `to` (the Scrub end camera), `layers` (visible Story layers; base-map layers are left alone) and `filters`. Every View is applied in full, so jumping straight to a Step gives the same map.
- Typography: `story.css` puts headings, lists, links and spacing back inside `.story`, matching what postal-sg was designed with. `Section.svelte` and `Scroller.svelte` carry `.story` until phase 4. Preflight is on; `html` keeps `line-height: normal`.
- `app.html`'s wrapper was `overflow-auto`, which made it a scroll container and broke `position: sticky`. It is `overflow-x-clip` now.

**Differences after turning Preflight on** (computed styles compared before and after on `/postal-sg/` and `/`): Story text is in the same place at the same size. These changed:
- the body's 8px margin is gone, so pages go edge to edge
- the header is 80px tall (it was 84px, because its border was added to the 80px)
- header buttons use Open Sans instead of the browser's button font
- the Front Page placeholder lost its paragraph margins (it's rebuilt in phase 5)

The postal-sg Steps couldn't be checked by eye on localhost, because R2's CORS rules block its data (phase 2). Their headings, paragraphs and lists get the same `.story` rules as the intro.

**Left for phase 5:** the Story list imports every Story's `metadata` eagerly, and a Draft's code is still built as an unlinked chunk in production. Neither is routable or listed.

**Coolify (done 2026-11-15):** `PUBLIC_INCLUDE_DRAFTS` is `true` for preview deployments and `false` for production, and PR previews are on (repository members only), at `{{pr_id}}.stories.bearylogical.net`.

**Still to do:** there is no DNS record for `*.stories.bearylogical.net`, so previews build but can't be opened. Cloudflare's free Universal SSL covers `*.bearylogical.net` but not a second-level wildcard such as `*.stories.bearylogical.net`. So either add a DNS-only (grey-cloud) wildcard record pointing at the Coolify server and let Coolify get the certificates, or change the preview URL template to one level, e.g. `stories-pr-{{pr_id}}.bearylogical.net`.

---

## Phase 4: postal-sg rebuild

**Goal:** `src/stories/postal-sg/index.svx` replaces `src/routes/postal-sg/+page.svelte`, at the same URL, looking and behaving the same, and faster.

**Scope:**
1. Rewrite the 8 Steps (`map01`–`map08`) as Views. The current behaviour to match:
   - districts outline
   - districts + heatmap
   - heatmap zoomed to `54*`
   - `54[1-4]264` at zoom 18, pitch 30
   - `542264` at pitch 45
   - `54*264` cluster circles
   - Explorer overlay
2. Keep the Explorer (postal code input, counts, building highlights) as a Svelte component embedded in the `.svx`.
3. Make it faster along the way:
   - Load the workers lazily.
   - No work on every scroll event; ScrollTrigger replaces the manual scroll handler.
   - Remove the flag-based state (`showHeatmap`, `showDistricts`, …) that Views replace.
   - Fix the type errors in the files touched.
4. **Visual check:** a Playwright script, `pnpm check:story <slug>`, scrolls to each Step and saves screenshots. Run it on the old version (the current `main` before this phase) and the new one, and compare them side by side. It's a manual comparison, not an automatic pass/fail, because map tiles change slightly between renders.
5. Delete the old route, `Scroller.svelte`, and the `$lib` modules nothing uses any more.

**Done when:** the screenshot comparison looks the same, `/postal-sg/index.html` still works, `pnpm check` has no errors in the touched files, and the first-load budget from phase 2 is met.

---

## Phase 5: The rest

**Scope:**
1. **Front Page** (`/`), built from the Story list:
   - The newest published Story featured large.
   - The rest listed newest first, each with image, title, date and summary.
   - A one-line introduction to the Publication, and its own link-preview tags and image.
   - Every Story gets a slim header linking back to the Front Page, using the existing `Header.svelte`.
2. **RSS:** `/rss.xml`, prerendered from the Story list, published Stories only.
3. **`pnpm new-story` wizard** using `@clack/prompts`. It asks, in order:
   - title
   - Slug (suggested from the title, checked to be unused)
   - summary
   - Stage kind (Map or Custom)
   - layout (Overlay or Sidecar)
   - number of starter Steps (default 3)
   - optional Story Data file names

   It then writes `src/stories/<slug>/index.svx` with `status: draft` and today's date, sets up `data/<slug>/`, and prints the dev URL. Every prompt also has a flag (`--title`, `--slug`, …, `--yes`), so it can run without prompts, e.g. from scripts or from Claude.
4. **README:** rewrite as "how to publish a Story": wizard, then write, then data publish, then PR preview, then set `status: published`, then merge.

**Done when:** a new Story can go from `pnpm new-story` to a PR preview without editing anything outside its own folder.
