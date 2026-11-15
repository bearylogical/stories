# stories (by bearylogical)

A Publication of visual data stories at [stories.bearylogical.net](https://stories.bearylogical.net). Each Story walks a reader through one dataset as they scroll.

Words such as Story, Slug, Scrolly, Stage, Step, View, Draft and Story Data have fixed meanings here; see [CONTEXT.md](CONTEXT.md). Decisions are in [docs/adr/](docs/adr/), and the plan is in [docs/ROADMAP.md](docs/ROADMAP.md).

## Setup

You need Node 22+ and pnpm.

```bash
git clone https://github.com/bearylogical/stories.git
cd stories
pnpm install
cp .env.example .env   # then add your MapTiler key
```

## How to publish a Story

A Story lives entirely in `src/stories/<slug>/`, with its Source Data in `data/<slug>/` (git-ignored). You shouldn't need to change anything outside those two folders.

### 1. Start it with the wizard

```bash
git switch -c story/<slug>
pnpm new-story
```

It asks for the title, the Slug (suggested from the title; it must be unused and never changes once published), a summary, the Stage kind (Map or Custom), the layout (Overlay or Sidecar), how many starter Steps, and any Story Data file names. It then writes:

- `src/stories/<slug>/index.svx`: the Story, as a Draft dated today
- `src/stories/<slug>/Stage.svelte`: for a Custom Stage
- `src/stories/<slug>/data.ts`: the URLs of its Story Data, if you named any files
- `data/<slug>/`: an empty folder for its Source Data

Every question also has a flag, so it can run without prompts:

```bash
pnpm new-story --title "Where Singapore's trees grow" --summary "…" \
  --stage map --layout overlay --steps 3 --data trees.geojson --yes
```

### 2. Write it

```bash
pnpm dev   # then open http://localhost:5173/<slug>/
```

The text is Markdown (mdsvex), and each Scrolly is a `<Scrolly>` with `<Step view={…}>`s. A Step declares a View; the Stage works out how to get there. `src/stories/_example/` shows every part, and `src/stories/postal-sg/` is a full Story. Components used by one Story only go in its folder.

The frontmatter holds the title, `published` date, summary, `image` (the link-preview image: a path in `static/` or a full URL, for example a published Story Data file) and `status`. A bad frontmatter field fails the build with a message that names it.

### 3. Publish its Story Data

Story Data is served from `https://data.bearylogical.net/<slug>/<name>.v<N>.<ext>`, and a published file never changes ([ADR 0003](docs/adr/0003-story-data-on-r2-per-slug-immutable.md)).

1. Put the files in `data/<slug>/` under the versioned names in `src/stories/<slug>/data.ts` (e.g. `trees.v1.geojson`). If they need processing first, add a build script at `scripts/data/<slug>/build.js` instead (see postal-sg's).
2. Check, then upload. This needs the [`cf` CLI](https://developers.cloudflare.com/cf/get-started/) (Node 22.18+) and `cf auth login`:
   ```bash
   pnpm data:publish <slug> --dry-run
   pnpm data:publish <slug>
   ```
3. To change a published file, add the next version (`trees.v2.geojson`), update its name in `data.ts`, and publish again.

To try files before publishing, serve them at `<host>/<slug>/` with CORS and run `VITE_DATA_HOST=<host> pnpm dev`.

### 4. Check the PR preview

Push the branch and open a pull request. Coolify builds a preview at `https://<pr-number>.stories.bearylogical.net`, with Drafts included, so the Story shows up there (marked as a Draft) on the Front Page and at `/<slug>/`. Check it on a phone too.

You can build the same thing locally with `pnpm preview:drafts`.

### 5. Set `status: published`

When it is ready, change `status: draft` to `status: published` in the frontmatter, and set `published` to the release date. Published Stories appear on the Front Page (the newest one featured) and in `/rss.xml`.

### 6. Merge

Merging to `main` deploys the Publication. After that the Slug is permanent.

## Reference

| Command                                     | What it does                                                             |
| ------------------------------------------- | ------------------------------------------------------------------------ |
| `pnpm dev`                                  | Dev server, Drafts included                                              |
| `pnpm new-story`                            | Starts a new Story (see above; `--help` lists the flags)                 |
| `pnpm build`                                | Production build into `build/`, Drafts left out                          |
| `pnpm build:drafts` / `pnpm preview:drafts` | Build (and serve) with Drafts, like a PR preview                         |
| `pnpm check`                                | Type-checks Svelte and TypeScript                                        |
| `pnpm lint` / `pnpm format`                 | Prettier and ESLint                                                      |
| `pnpm data:publish <slug>`                  | Uploads a Story's Story Data to R2                                       |
| `pnpm check:story <slug>`                   | Screenshots every Step and reports the bytes loaded before the first one |

The older scripts in `scripts/` need their own install: `pnpm -C scripts install`.

### Deployment

The Publication is a fully static site, with every page prerendered ([ADR 0001](docs/adr/0001-static-build-served-by-nginx-on-coolify.md)).

- **Coolify** builds `main` from the `Dockerfile` (a Node build stage, then `nginx:1.30-alpine` with `nginx.conf`). Pushing to `main` deploys; every open PR gets a preview. To check the image locally: `docker build --build-arg PUBLIC_MAPTILER_KEY=... -t stories . && docker run -p 4173:80 stories`.
- **Build variables:** `PUBLIC_MAPTILER_KEY`, and `PUBLIC_INCLUDE_DRAFTS` (true for PR previews only). Each needs an `ARG` in the `Dockerfile`. Nothing reads runtime variables.
- **URLs:** each Story is written to `<slug>/index.html`. `/<slug>/` is the canonical URL; `/<slug>` and `/<slug>/index.html` also work.
