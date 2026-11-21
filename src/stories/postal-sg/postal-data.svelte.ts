/**
 * postal-sg's points, counted and filtered in a worker. The worker is loaded once the map has
 * drawn its first frame. The map gets every point once (`postal.allPoints`) and filters them
 * itself; queries return counts, bounds, and the points with addresses for small results.
 */
import { urls } from '$lib/data/postal-sg.js';
import {
	MESSAGES,
	type FromWorker,
	type PostalPoints,
	type PostalResult,
	type ToWorker
} from './postal-protocol.js';

export type { Bounds, PostalPoints, PostalProperties, PostalResult } from './postal-protocol.js';

export const NO_POINTS: PostalPoints = { type: 'FeatureCollection', features: [] };

/** How many recent results to keep, besides `*` and prefetched ones. */
const CACHE_SIZE = 12;

class PostalData {
	/** How many points (addresses) there are, once loaded. */
	total: number | undefined = $state();
	/** How many distinct postal codes, once loaded. */
	unique: number | undefined = $state();
	/** How many sectors (first two digits) are in use, once loaded. */
	sectors: number | undefined = $state();
	/** A blob: URL of every point as GeoJSON, for the map's source. */
	allPoints: string | undefined = $state();
	/** Why loading failed, if it did. */
	error: string | undefined = $state();

	#worker: Promise<Worker> | undefined;
	#cache = new Map<string, Promise<PostalResult>>();
	#pinned = new Set<string>(['*']);
	/** Queries sent to the worker and not yet answered, by request id. */
	#waiting = new Map<number, { resolve: (r: PostalResult) => void; reject: (e: Error) => void }>();
	#nextId = 0;

	/** Starts loading the points (once). */
	load(): Promise<Worker> {
		this.#worker ??= this.#start();
		return this.#worker;
	}

	async #start(): Promise<Worker> {
		const { default: PostalWorker } = await import('./workers/postal-worker.js?worker');
		const worker = new PostalWorker();
		return new Promise((resolve, reject) => {
			worker.onmessage = (e: MessageEvent<FromWorker>) => {
				const message = e.data;
				if (message.type === MESSAGES.LOAD_COMPLETE) {
					const data = message.data;
					if (!data.success) {
						this.error = data.error;
						reject(new Error(data.error));
						return;
					}
					this.total = data.count;
					this.unique = data.unique;
					this.sectors = data.sectors;
					this.allPoints = URL.createObjectURL(
						new Blob([data.geojson], { type: 'application/geo+json' })
					);
					this.#cache.set(
						'*',
						Promise.resolve({
							pattern: '*',
							count: data.count,
							unique: data.unique,
							bounds: data.bounds,
							features: null
						})
					);
					resolve(worker);
				} else if (message.type === MESSAGES.FILTER_COMPLETE) {
					this.#settle(message.data.id)?.resolve(message.data.result);
				} else if (message.type === MESSAGES.ERROR) {
					const { id, message: text } = message.data;
					if (id === undefined) this.error = text;
					else this.#settle(id)?.reject(new Error(text));
				}
			};
			worker.postMessage({
				type: MESSAGES.LOAD_DATA,
				data: { url: urls.points }
			} satisfies ToWorker);
		});
	}

	#settle(id: number) {
		const waiting = this.#waiting.get(id);
		this.#waiting.delete(id);
		return waiting;
	}

	/** The points matching `pattern` (see ../pattern.js). Cached. */
	query(pattern: string): Promise<PostalResult> {
		const cached = this.#cache.get(pattern);
		if (cached) {
			// Most recently used last.
			this.#cache.delete(pattern);
			this.#cache.set(pattern, cached);
			return cached;
		}
		const result = this.load().then((worker) => {
			// LOAD_COMPLETE has cached `*` by now.
			if (pattern === '*') return this.#cache.get('*')!;
			return new Promise<PostalResult>((resolve, reject) => {
				const id = this.#nextId++;
				this.#waiting.set(id, { resolve, reject });
				worker.postMessage({ type: MESSAGES.FILTER, data: { id, pattern } } satisfies ToWorker);
			});
		});
		this.#cache.set(pattern, result);
		result.catch(() => this.#cache.delete(pattern));
		for (const key of this.#cache.keys()) {
			if (this.#cache.size <= CACHE_SIZE + this.#pinned.size) break;
			if (!this.#pinned.has(key)) this.#cache.delete(key);
		}
		return result;
	}

	/**
	 * Queries the Story's own patterns ahead of time, so their points and addresses are ready
	 * before the reader scrolls to them. They stay cached.
	 */
	prefetch(patterns: string[]): void {
		for (const pattern of patterns) {
			this.#pinned.add(pattern);
			this.query(pattern).catch(() => {});
		}
	}
}

/** postal-sg's points. Only used in the browser (from effects), never while prerendering. */
export const postal = new PostalData();
