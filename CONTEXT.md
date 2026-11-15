# Bearylogical Stories

A publication of visual data stories at stories.bearylogical.net. Each piece walks a reader through one dataset as they scroll.

## Language

### Publication

**Publication**:
The whole site at stories.bearylogical.net: the collection of Stories under one brand, with an index of them.
_Avoid_: Site, blog, template

**Front Page**:
The Publication's home at `/`: the newest Story featured, the rest of the published Stories listed below it, and a one-line introduction to the Publication.
_Avoid_: Landing page, homepage, index

**Story**:
One narrative about a dataset, published at one Slug on a date. Any interactive free-play part (such as an Explorer) belongs to its Story.
_Avoid_: Datastory, article, post, page

**Draft**:
A Story that hasn't been published yet. Its author and reviewers can see it; readers of the Publication can't.
_Avoid_: Unpublished, WIP, hidden

**Slug**:
The permanent URL name of a Story (e.g. `postal-sg`). Once published, it never changes.
_Avoid_: Route, path, ID

**Explorer**:
The free-play part of a Story, usually at the end, where the reader controls the graphic directly instead of being guided by Steps.
_Avoid_: Tool, playground, sandbox

### Scrollytelling

**Scrolly**:
A stretch of a Story where a pinned Stage changes as the reader scrolls a sequence of Steps past it.
_Avoid_: Scroller, scrollytelling section

**Stage**:
The graphic pinned behind or beside a Scrolly's Steps, such as a map or a chart. It shows whatever View the current Step asks for.
_Avoid_: Background, graphic, canvas, visual

**Step**:
One unit of narrative in a Scrolly. When the reader reaches it, it asks the Stage to show a View.
_Avoid_: Section, caption, slide, card, foreground

**View**:
The state a Step declares for the Stage (e.g. which layers are on, what is filtered, where the camera is). The Stage decides how to get from one View to the next.
_Avoid_: Action, state, config

**Scrub**:
A Step mode where the Stage follows the reader's scroll position through the Step continuously, instead of switching once when the Step is reached.
_Avoid_: Progress, parallax

**Overlay**:
A Scrolly layout where Steps scroll as cards over a full-screen Stage.
_Avoid_: Fullscreen mode

**Sidecar**:
A Scrolly layout where Steps and Stage sit side by side; on narrow screens it falls back to Overlay.
_Avoid_: Split screen, splitscreen

### Data

**Story Data**:
The published data files a Story loads, stored under that Story's Slug on the data host. A published file never changes; a new revision gets a new versioned name.
_Avoid_: Assets, dataset (for the published files)

**Source Data**:
The raw upstream data and the scripts that turn it into Story Data. Kept with the code, not shipped to readers.
_Avoid_: Raw assets
