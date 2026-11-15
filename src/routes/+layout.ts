// Every page of the Publication is prerendered (docs/adr/0001).
export const prerender = true;
// Emit <slug>/index.html so /<slug>/index.html keeps working; /<slug>/ is canonical.
export const trailingSlash = 'always';
