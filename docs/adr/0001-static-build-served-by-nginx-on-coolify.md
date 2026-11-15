# Static build served by nginx on Coolify

Every Story is prerendered, so the Publication is built with `adapter-static` and Coolify serves the `build/` output from `nginx:alpine`. We do not run a Node server. The history has gone back and forth between `adapter-node` and static several times; no feature needs a server, and the Node setup broke permanent URLs (`/postal-sg/index.html` returned 404). nginx's `try_files $uri $uri.html $uri/index.html` keeps every form of a Slug's URL working.

## Consequences

- Secrets are only used at build time. Nothing reads environment variables at runtime, so a key only needs to be set as a build variable in Coolify.
- If a server feature ever comes back (dynamic OG images, an API), it goes in a separate service, not this app.
