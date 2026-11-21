import { describe, expect, it } from 'vitest';
import {
	DATA_HOST,
	isVersionedName,
	parseVersionedName,
	storyDataKey,
	storyDataUrl,
	storyDataUrls,
	versionedName
} from './story-data.js';
import { files, urls } from './postal-sg.js';

describe('versionedName ↔ parseVersionedName', () => {
	it.each([
		['counts', 1, 'csv'],
		['district-counts', 12, 'geojson'],
		['addresses-54', 1, 'json'],
		['points', 2, 'bin'],
		['2024-results', 3, 'pmtiles']
	])('round-trips %s v%i .%s', (name, version, ext) => {
		const file = versionedName(name, version, ext);
		expect(file).toBe(`${name}.v${version}.${ext}`);
		expect(isVersionedName(file)).toBe(true);
		expect(parseVersionedName(file)).toEqual({ name, version, ext });
	});

	it.each([
		['Counts', 1, 'csv'],
		['-counts', 1, 'csv'],
		['counts.raw', 1, 'csv'],
		['', 1, 'csv'],
		['counts', 0, 'csv'],
		['counts', 1.5, 'csv'],
		['counts', -1, 'csv'],
		['counts', 1, '.csv'],
		['counts', 1, 'CSV'],
		['counts', 1, '']
	])('rejects building %j v%j .%j', (name, version, ext) => {
		expect(() => versionedName(name, version, ext)).toThrow();
	});

	it.each([
		'counts.csv',
		'counts.v1',
		'counts.v.csv',
		'counts.v0.csv',
		'counts.v01.csv',
		'counts.V1.csv',
		'Counts.v1.csv',
		'-counts.v1.csv',
		'counts.raw.v1.csv',
		'counts.v1.csv.gz',
		'counts.v1.',
		'.v1.csv',
		'postal-sg/counts.v1.csv'
	])('rejects parsing %j', (file) => {
		expect(parseVersionedName(file)).toBeNull();
		expect(isVersionedName(file)).toBe(false);
	});
});

describe('Story Data URLs', () => {
	it('puts files under <host>/<slug>/', () => {
		expect(storyDataKey('my-story', 'counts.v1.csv')).toBe('my-story/counts.v1.csv');
		expect(storyDataUrl('my-story', 'counts.v1.csv')).toBe(`${DATA_HOST}/my-story/counts.v1.csv`);
	});

	it('maps file names and name-makers to URLs', () => {
		const u = storyDataUrls('my-story', {
			counts: versionedName('counts', 1, 'csv'),
			/** @param {string} s */
			sector: (s) => versionedName(`sector-${s}`, 2, 'json')
		});
		expect(u.counts).toBe(`${DATA_HOST}/my-story/counts.v1.csv`);
		expect(u.sector('54')).toBe(`${DATA_HOST}/my-story/sector-54.v2.json`);
	});

	it('keeps postal-sg names and URLs as published', () => {
		expect(files.points).toBe('points.v2.bin');
		expect(files.addresses('54')).toBe('addresses-54.v1.json');
		expect(files.districts).toBe('districts.v1.geojson');
		expect(urls.points).toBe(`${DATA_HOST}/postal-sg/points.v2.bin`);
		expect(urls.addresses('54')).toBe(`${DATA_HOST}/postal-sg/addresses-54.v1.json`);
		expect(urls.districts).toBe(`${DATA_HOST}/postal-sg/districts.v1.geojson`);
	});
});
