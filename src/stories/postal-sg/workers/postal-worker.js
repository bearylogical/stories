// postal-worker.js
//
// Message plumbing for postal-sg's points: fetches the packed points and the per-sector
// address lists, and answers the page's messages (../postal-protocol.js) from a postal
// index (../postal-index.js). It hands the map every point once; the map filters its own
// copy with the same pattern, so a query never re-sends the whole island.

import { urls } from '$lib/data/postal-sg.js';
import { createPostalIndex } from '../postal-index.js';
import { MESSAGES } from '../postal-protocol.js';

/** @typedef {import('../postal-protocol.js').ToWorker} ToWorker */
/** @typedef {import('../postal-protocol.js').FromWorker} FromWorker */
/** @typedef {import('../postal-protocol.js').PostalLoaded} PostalLoaded */

/** @type {import('../postal-index.js').PostalIndex | undefined} */
let index;

/** @param {FromWorker} message */
const reply = (message) => self.postMessage(message);

/** @param {string} url @returns {Promise<Response>} */
async function fetchOk(url) {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
	return response;
}

/** @param {string} sector @returns {Promise<string[]>} */
const loadAddresses = async (sector) => (await fetchOk(urls.addresses(sector))).json();

/** @param {string} url @returns {Promise<PostalLoaded>} */
async function load(url) {
	try {
		index = createPostalIndex(await (await fetchOk(url)).arrayBuffer(), loadAddresses);
		// As text: cloning one string to the page is cheap, and MapLibre parses it in its
		// own worker, so the page never holds 140,000 feature objects.
		return { success: true, geojson: JSON.stringify(index.allPoints()), ...index.overview };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

/** @param {MessageEvent<ToWorker>} e */
self.onmessage = async function (e) {
	const message = e.data;
	switch (message.type) {
		case MESSAGES.LOAD_DATA:
			reply({ type: MESSAGES.LOAD_COMPLETE, data: await load(message.data.url) });
			break;

		case MESSAGES.FILTER: {
			const { id, pattern } = message.data;
			try {
				if (!index) throw new Error('Points not loaded');
				reply({ type: MESSAGES.FILTER_COMPLETE, data: { id, result: await index.query(pattern) } });
			} catch (error) {
				const text = error instanceof Error ? error.message : String(error);
				reply({ type: MESSAGES.ERROR, data: { id, message: text } });
			}
			break;
		}

		default:
			reply({ type: MESSAGES.ERROR, data: { message: 'Unknown message type' } });
	}
};
