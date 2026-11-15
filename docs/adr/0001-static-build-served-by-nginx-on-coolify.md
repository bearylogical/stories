# Static build served by nginx on Coolify

Every Story is prerendered, so the Publication is built with `adapter-static` and served as plain files by nginx. Coolify builds the repo's two-stage `Dockerfile`: Node runs `pnpm build`, then the output is copied into a pinned `nginx` image with the repo's `nginx.conf`. We do not run a Node server. The history has gone back and forth between `adapter-node` and static several times; no feature needs a server, and the Node setup broke permanent URLs (`/postal-sg/index.html` returned 404). nginx's `try_files $uri $uri.html $uri/index.html` keeps every form of a Slug's URL working.

## Consequences

- Secrets are only used at build time. Nothing reads environment variables at runtime, so a key only needs to be set as a build variable in Coolify.
- The build is in the repo, not in Coolify settings. We first used Coolify's Railpack static mode, but its web server image can't be pinned (only `nginx:alpine` is offered), the nginx config lived in Coolify, and each deploy spent about 28 s exporting an intermediate image with `node_modules` (see docs/ROADMAP.md, phase 2).
- Build variables reach the build as Docker build args, so each one needs an `ARG` in the `Dockerfile`.
- If a server feature ever comes back (dynamic OG images, an API), it goes in a separate service, not this app.
