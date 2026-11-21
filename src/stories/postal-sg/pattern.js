// Postal code patterns, shared by the points worker (which counts and finds matches, see
// `matcher`) and the map (which filters the points layers with the same rule, see
// `patternFilter`). pattern.test.js checks the two agree.
//
// A pattern is six positions written as digits or `[a-b]` digit ranges, and at most one `*`,
// which stands for however many positions are left:
//
//   *            every code
//   54*          sector 54
//   54[2-4]264   542264, 543264, 544264
//   54*264       540264 … 549264
//   54[5-9]*     sector 54, third digit 5–9
//   542264       one code

/** @typedef {(string[] | null)[]} Positions allowed digits per position (null: any) */

const DIGITS = '0123456789';

/**
 * @param {string} pattern
 * @returns {Positions | null} null when the pattern isn't valid
 */
export function parsePattern(pattern) {
	/** @type {(string[] | null | '*')[]} */
	const tokens = [];
	let i = 0;
	while (i < pattern.length) {
		const c = pattern[i];
		if (DIGITS.includes(c)) {
			tokens.push([c]);
			i++;
		} else if (c === '*') {
			if (tokens.includes('*')) return null;
			tokens.push('*');
			i++;
		} else if (c === '[') {
			const m = pattern.slice(i).match(/^\[(\d)-(\d)\]/);
			if (!m || m[1] > m[2]) return null;
			tokens.push([...DIGITS.slice(Number(m[1]), Number(m[2]) + 1)]);
			i += m[0].length;
		} else {
			return null;
		}
	}
	const fixed = tokens.filter((t) => t !== '*').length;
	const star = tokens.indexOf('*');
	if (star < 0) return fixed === 6 ? /** @type {Positions} */ (tokens) : null;
	if (fixed > 6) return null;
	return /** @type {Positions} */ ([
		...tokens.slice(0, star),
		...Array(6 - fixed).fill(null),
		...tokens.slice(star + 1)
	]);
}

/**
 * @param {string} pattern
 * @returns {(postal: string) => boolean}
 */
export function matcher(pattern) {
	const positions = parsePattern(pattern);
	if (!positions) return () => false;
	/** @type {{ allowed: string[], index: number }[]} */
	const checks = [];
	positions.forEach((allowed, index) => {
		if (allowed) checks.push({ allowed, index });
	});
	return (postal) => checks.every(({ allowed, index }) => allowed.includes(postal[index]));
}

/**
 * A MapLibre filter on the `POSTAL` property for the same pattern, or undefined for `*`.
 * @param {string} pattern
 * @returns {import('maplibre-gl').FilterSpecification | undefined}
 */
export function patternFilter(pattern) {
	const positions = parsePattern(pattern);
	if (!positions) return ['==', ['get', 'POSTAL'], '__none__'];
	/** @type {any[]} */
	const checks = [];
	let i = 0;
	while (i < 6) {
		const allowed = positions[i];
		if (!allowed) {
			i++;
		} else if (allowed.length > 1) {
			checks.push(['in', ['slice', ['get', 'POSTAL'], i, i + 1], ['literal', allowed]]);
			i++;
		} else {
			// A run of exact digits is one comparison.
			let end = i;
			let text = '';
			while (end < 6 && positions[end]?.length === 1) text += positions[end++]?.[0];
			checks.push(
				i === 0 && end === 6
					? ['==', ['get', 'POSTAL'], text]
					: ['==', ['slice', ['get', 'POSTAL'], i, end], text]
			);
			i = end;
		}
	}
	if (checks.length === 0) return undefined;
	return /** @type {any} */ (checks.length === 1 ? checks[0] : ['all', ...checks]);
}
