# Steps declare Views; GSAP ScrollTrigger drives the Scrolly

A Step says *what* the Stage should show (a View, a plain data object in the mdsvex text). It does not say *how* to get there. Each Stage kind (e.g. MapStage) turns a View into an animation. Scroll position is tracked with GSAP ScrollTrigger. This replaces the ONS-derived `Scroller`, where each step ID mapped to a callback that set a dozen flags.

## Considered Options

- **Keep callbacks per Step**: anything is possible, but the logic lives away from the text and every Story has to know how the map works internally. We kept it only as an escape hatch (`onenter`).
- **Keep the ONS Scroller**: it has no Scrub, no pinning control, and needs IE patches we no longer want.

## Consequences

- Stories can be written, or generated, as Markdown plus Views, without touching map code.
- A Stage has to handle reaching any View directly (a reader may jump straight to a Step), not only the next one in order.
