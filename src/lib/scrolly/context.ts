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
	/** The active Step's progress, 0–1 (1 unless it is a Scrub Step). */
	readonly progress: number;
}

/** What a Step tells the content inside it, e.g. a caption that follows a Scrub. */
export interface StepContext {
	/** Whether the Stage is showing this Step. */
	readonly active: boolean;
	/** 0 before this Step, its progress while active, 1 after it. */
	readonly progress: number;
}

const KEY = Symbol('scrolly');
const STEP_KEY = Symbol('scrolly-step');

export function setScrollyContext<V>(context: ScrollyContext<V>): void {
	setContext(KEY, context);
}

export function getScrollyContext<V>(): ScrollyContext<V> {
	const context = getContext<ScrollyContext<V> | undefined>(KEY);
	if (!context) throw new Error('<Step> must be inside a <Scrolly>');
	return context;
}

export function setStepContext(context: StepContext): void {
	setContext(STEP_KEY, context);
}

/** The Step around this component. */
export function getStepContext(): StepContext {
	const context = getContext<StepContext | undefined>(STEP_KEY);
	if (!context) throw new Error('getStepContext() must be called inside a <Step>');
	return context;
}
