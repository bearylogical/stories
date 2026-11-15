# syntax=docker/dockerfile:1
# Static build served by nginx (docs/adr/0001). Coolify builds this with the
# Dockerfile build pack and passes build variables as build args.

# --- Build: prerender the Publication into /app/build -----------------------
FROM node:22.23-alpine AS build
WORKDIR /app

# pnpm version comes from package.json's "packageManager".
RUN corepack enable

# Install first, from the lockfile only, so this layer is reused until the
# dependencies change. The pnpm store is a BuildKit cache shared across builds.
COPY package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
	pnpm config set store-dir /pnpm/store && \
	pnpm install --frozen-lockfile

COPY . .

# Read at build time only ($env/static/public, vite.config.ts).
ARG PUBLIC_MAPTILER_KEY
ARG PUBLIC_INCLUDE_DRAFTS=false
ENV PUBLIC_MAPTILER_KEY=$PUBLIC_MAPTILER_KEY \
	PUBLIC_INCLUDE_DRAFTS=$PUBLIC_INCLUDE_DRAFTS

RUN pnpm build

# --- Serve -------------------------------------------------------------------
FROM nginx:1.30-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
