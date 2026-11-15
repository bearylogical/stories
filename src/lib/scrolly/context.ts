import { getContext, setContext } from 'svelte';

/** Which way the reader was scrolling when a Step was reached. */
export type Direction = 'forward' | 'backward';

/** What a Step tells its Scrolly. Getters, so the Scrolly always reads current props. */
export interface StepEntry<V = unknown> {
	readonly view: V;
	readonly scrub: boolean;
	readonly onenter?: (direction: Direction) => void;
	readonly element: HTMLElement | undefined;
}

export interface ScrollyContext<V = unknown> {
	/** Adds a Step in document order and returns its index. */
	register(step: StepEntry<V>): number;
	/** Index of the Step the Stage is showing. */
	readonly active: number;
}

const KEY = Symbol('scrolly');

export function setScrollyContext<V>(context: ScrollyContext<V>): void {
	setContext(KEY, context);
}

export function getScrollyContext<V>(): ScrollyContext<V> {
	const context = getContext<ScrollyContext<V> | undefined>(KEY);
	if (!context) throw new Error('<Step> must be inside a <Scrolly>');
	return context;
}
