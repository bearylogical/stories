# Stories 📖

## What is this?

This project is a collection of visual stories, each exploring a different dataset. The goal is to provide a simple way for users to appreciate the stories that data can tell. 

## Development

This is a SvelteKit project. To get started, you'll need to have Node.js and pnpm installed.

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/bearylogical/stories.git
   cd stories
   ```

2. **Install dependencies** and copy `.env.example` to `.env` (add your MapTiler key):
   ```bash
   pnpm install
   ```

### Running the development server

To start the development server, run:

```bash
pnpm run dev
```

This will start the application on `http://localhost:5173`.

### Building for production

To create a production version of the app, run:

```bash
pnpm run build
```

You can preview the production build with `pnpm run preview`.

### Linting and formatting

This project uses Prettier for code formatting and ESLint for linting.

- **To check for formatting and linting errors:**
  ```bash
  pnpm run lint
  ```

- **To automatically format the code:**
  ```bash
  pnpm run format
  ```


## Deployment

The Publication is a fully static site (`@sveltejs/adapter-static`, every page prerendered; see [ADR 0001](docs/adr/0001-static-build-served-by-nginx-on-coolify.md)).

- **Coolify** builds `main` and serves `build/` with `nginx:alpine`. Pushing to `main` deploys.
- **Build variables:** `PUBLIC_MAPTILER_KEY` only. Nothing reads runtime variables.
- **URLs:** each page is written to `<slug>/index.html`. `/<slug>/` is the canonical URL, and `/<slug>` and `/<slug>/index.html` also work. Slugs never change once published.

## Project language

Terms such as Story, Stage, Step and View are defined in [CONTEXT.md](CONTEXT.md). Architectural decisions are in [docs/adr/](docs/adr/). The phased plan and its status are in [docs/ROADMAP.md](docs/ROADMAP.md).
