// Builds postal-sg's Story Data from its Source Data.
//
//   data/postal-sg/singpostcode.geojson        → points.vN.bin + addresses-<SS>.vN.json
//   data/postal-sg/singapore_districts.geojson → districts.vN.geojson
//
// Names and versions come from src/lib/data/postal-sg.js, which the page reads too.

import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { encodePostalPoints, sectorOf } from '../../../src/lib/data/postal-points.js';
import { files } from '../../../src/lib/data/postal-sg.js';

/**
 * @param {{ sourceDir: string, outDir: string }} dirs
 * @returns {Promise<{ name: string, contentType: string }[]>} files written to outDir
 */
export async function build({ sourceDir, outDir }) {
	const source = JSON.parse(await readFile(join(sourceDir, 'singpostcode.geojson'), 'utf8'));

	const points = [];
	let skipped = 0;
	for (const feature of source.features) {
		const postal = feature.properties?.POSTAL;
		const coords = feature.geometry?.coordinates;
		// A handful of OneMap entries (East Coast Park areas) have POSTAL "NIL".
		if (!/^\d{6}$/.test(postal ?? '') || feature.geometry?.type !== 'Point') {
			skipped++;
			continue;
		}
		points.push({
			code: Number(postal),
			lon: coords[0],
			lat: coords[1],
			address: feature.properties.ADDRESS ?? ''
		});
	}
	// Sort by code, then address, so the output is the same on every build.
	points.sort((a, b) => a.code - b.code || (a.address < b.address ? -1 : a.address > b.address ? 1 : 0));

	const written = [];

	await writeFile(join(outDir, files.points), encodePostalPoints(points));
	written.push({ name: files.points, contentType: 'application/octet-stream' });

	const bySector = new Map();
	for (const p of points) {
		const sector = sectorOf(p.code);
		if (!bySector.has(sector)) bySector.set(sector, []);
		bySector.get(sector).push(p.address);
	}
	for (const [sector, addresses] of bySector) {
		const name = files.addresses(sector);
		await writeFile(join(outDir, name), JSON.stringify(addresses));
		written.push({ name, contentType: 'application/json' });
	}

	await copyFile(join(sourceDir, 'singapore_districts.geojson'), join(outDir, files.districts));
	written.push({ name: files.districts, contentType: 'application/geo+json' });

	console.log(
		`postal-sg: ${points.length} points (${skipped} without a postal code skipped), ${bySector.size} sectors`
	);
	return written;
}
