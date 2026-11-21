/**
 * Where the Sweep is, shared from the Stage (which works it out, see `sweepAt` in
 * ./stage-spec.ts) with the Sweep Step's caption, so the two can't disagree. The Story sets it
 * up once, around both its Stage and its Steps.
 */
import { getContext, setContext } from 'svelte';
import type { PostalProperties } from './postal-data.svelte';

export class SweepCursor {
	/** The point the Sweep last reached; kept after the reader leaves the Sweep's Step. */
	at: PostalProperties | undefined = $state.raw();
}

const KEY = Symbol('postal-sweep');

/** Call in the Story, so its Stage and its Steps share one cursor. */
export function setSweepContext(): SweepCursor {
	return setContext(KEY, new SweepCursor());
}

export function getSweepContext(): SweepCursor {
	const cursor = getContext<SweepCursor | undefined>(KEY);
	if (!cursor) throw new Error('getSweepContext() needs setSweepContext() in the Story');
	return cursor;
}
