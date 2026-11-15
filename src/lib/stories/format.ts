/** A Story date (`YYYY-MM-DD`) as readers see it, e.g. "15 November 2026". */
export function formatDate(iso: string): string {
	return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-SG', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	});
}
