import type { FeatureCollection, Point } from 'geojson';

export interface Place {
	name: string;
	kind: 'park' | 'landmark';
}

/** A few places in Singapore, inline so the sample needs no Story Data. */
export const places: FeatureCollection<Point, Place> = {
	type: 'FeatureCollection',
	features: (
		[
			['Gardens by the Bay', 'park', 103.8636, 1.2816],
			['Botanic Gardens', 'park', 103.8159, 1.3138],
			['Fort Canning Park', 'park', 103.8461, 1.2955],
			['East Coast Park', 'park', 103.9126, 1.3008],
			['Merlion', 'landmark', 103.8545, 1.2868],
			['Marina Bay Sands', 'landmark', 103.8607, 1.2834],
			['Raffles Hotel', 'landmark', 103.8545, 1.2949]
		] as const
	).map(([name, kind, lng, lat]) => ({
		type: 'Feature',
		properties: { name, kind },
		geometry: { type: 'Point', coordinates: [lng, lat] }
	}))
};
