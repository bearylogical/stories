/**
 * postal-sg's points, filtered in a worker. Both workers are loaded only when first needed:
 * the points worker once the map has drawn its first frame, the buildings worker (which
 * bundles turf) the first time a View shows buildings.
 */
import type { Feature, FeatureCollection, Geometry, Point } from 'geojson';
import { urls } from '$lib/data/postal-sg.js';

export interface PostalProperties {
	POSTAL: string;
	ADDRESS?: string;
}
export type PostalPoints = FeatureCollection<Point, PostalProperties>;
export type Bounds = [[west: number, south: number], [east: number, north: number]];

export interface PostalResult {
	pattern: string;
	count: number;
	features: PostalPoints;
	bounds: Bounds | null;
}

export const NO_POINTS: PostalPoints = { type: 'FeatureCollection', features: [] };

/** How many recent results to keep, besides `*`. */
const CACHE_SIZE = 12;

class PostalData {
	/** How many postal codes there are, once loaded. */
	total: number | undefined = $state();
	/** Why loading failed, if it did. */
	error: string | undefined = $state();

	#worker: Promise<Worker> | undefined;
	#cache = new Map<string, Promise<PostalResult>>();
	#waiting = new Map<string, (result: PostalResult) => void>();

	/** Starts loading the points (once). */
	load(): Promise<Worker> {
		this.#worker ??= this.#start();
		return this.#worker;
	}

	async #start(): Promise<Worker> {
		const { default: PostalWorker } = await import('./workers/postal-worker.js?worker');
		const worker = new PostalWorker();
		return new Promise((resolve, reject) => {
			worker.onmessage = (e: MessageEvent) => {
				const { type, data } = e.data;
				if (type === 'LOAD_COMPLETE') {
					if (!data.success) {
						this.error = data.error;
						reject(new Error(data.error));
						return;
					}
					this.total = data.count;
					this.#cache.set('*', Promise.resolve({ pattern: '*', ...data }));
					resolve(worker);
				} else if (type === 'FILTER_COMPLETE') {
					this.#waiting.get(data.pattern)?.(data);
					this.#waiting.delete(data.pattern);
				} else if (type === 'ERROR') {
					this.error = data.message;
				}
			};
			worker.postMessage({ type: 'LOAD_DATA', data: { url: urls.points } });
		});
	}

	/** The points matching `pattern` (see the worker for the syntax). Cached. */
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
			return new Promise<PostalResult>((resolve) => {
				this.#waiting.set(pattern, resolve);
				worker.postMessage({ type: 'FILTER', data: { pattern, maxResults: -1 } });
			});
		});
		this.#cache.set(pattern, result);
		result.catch(() => this.#cache.delete(pattern));
		for (const key of this.#cache.keys()) {
			if (this.#cache.size <= CACHE_SIZE + 1) break;
			if (key !== '*') this.#cache.delete(key);
		}
		return result;
	}
}

/** postal-sg's points. Only used in the browser (from effects), never while prerendering. */
export const postal = new PostalData();

export type BuildingFeature = Feature<Geometry, Record<string, unknown>>;
export type ColoredBuildings = FeatureCollection<Geometry, Record<string, unknown>>;

let buildingWorker: Promise<Worker> | undefined;
let nextRequest = 0;

/**
 * The buildings, as polygons coloured by whether a postal point is inside them, with that
 * point's properties (e.g. ADDRESS) merged in.
 */
export async function colorBuildings(
	points: Feature<Point, PostalProperties>[],
	buildings: BuildingFeature[]
): Promise<ColoredBuildings> {
	buildingWorker ??= import('./workers/building-color-worker.ts?worker').then(
		({ default: BuildingWorker }) => new BuildingWorker()
	);
	const worker = await buildingWorker;
	const id = nextRequest++;
	return new Promise((resolve) => {
		const onMessage = (e: MessageEvent) => {
			if (e.data.type !== 'BUILDING_COLORS_UPDATED' || e.data.id !== id) return;
			worker.removeEventListener('message', onMessage);
			resolve(e.data.data);
		};
		worker.addEventListener('message', onMessage);
		worker.postMessage({
			type: 'UPDATE_BUILDING_COLORS',
			id,
			data: { postalPoints: points, buildingFeatures: buildings }
		});
	});
}
