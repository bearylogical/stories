// Colours the map's buildings by whether a postal point lies inside them (within 0.5 m).
//
// Message in:  UPDATE_BUILDING_COLORS { id, data: { postalPoints, buildingFeatures } }
// Message out: BUILDING_COLORS_UPDATED { id, data: FeatureCollection } — one polygon per
// building part, with the matching point's properties (e.g. ADDRESS) merged in.

import * as turf from '@turf/turf';
import type { Feature, FeatureCollection, Geometry, Point, Polygon, Position } from 'geojson';

type Properties = Record<string, unknown>;

const MATCHED = '#d14200';
const UNMATCHED = '#aaa';

function colorBuildings(
	postalPoints: Feature<Point, Properties>[],
	buildingFeatures: Feature<Geometry, Properties>[]
): FeatureCollection<Geometry, Properties> {
	const out: FeatureCollection<Geometry, Properties> = { type: 'FeatureCollection', features: [] };

	for (const building of buildingFeatures) {
		const { geometry } = building;
		if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') continue;
		// One polygon at a time, so a MultiPolygon's parts are matched separately.
		const parts: Position[][][] =
			geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];

		parts.forEach((coordinates, polygonIndex) => {
			const buffered = turf.buffer(turf.polygon(coordinates), 0.5, { units: 'meters' }) as
				| Feature<Polygon>
				| undefined;
			if (!buffered) return;
			const match = postalPoints.find((point) => turf.booleanPointInPolygon(point, buffered));
			out.features.push({
				type: 'Feature',
				properties: {
					...building.properties,
					...match?.properties,
					original_id: building.id,
					building_color: match ? MATCHED : UNMATCHED,
					polygon_index: polygonIndex,
					render_height: building.properties?.render_height || 30
				},
				geometry: buffered.geometry
			});
		});
	}
	return out;
}

self.onmessage = (e: MessageEvent) => {
	const { type, id, data } = e.data;
	if (type !== 'UPDATE_BUILDING_COLORS') return;
	self.postMessage({
		type: 'BUILDING_COLORS_UPDATED',
		id,
		data: colorBuildings(data.postalPoints, data.buildingFeatures)
	});
};
