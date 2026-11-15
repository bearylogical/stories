/**
 * The Stage contract (docs/adr/0002): any component that takes these props can be a Stage.
 *
 * - `view` is the View the active Step declares. A Stage must be able to reach any View
 *   directly, not only the next one, because a reader can land on any Step.
 * - `progress` runs from 0 to 1 while the reader scrolls through a Scrub Step. It is 1 for
 *   ordinary Steps, and for every Step when the reader prefers reduced motion.
 */
export interface StageProps<V> {
	view: V;
	progress: number;
}

export type ScrollyLayout = 'overlay' | 'sidecar';
