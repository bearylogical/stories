import { stories } from '$lib/stories';
import type { PageServerLoad } from './$types';

// A server load, run once while prerendering: the Front Page only needs each Story's
// frontmatter, and this keeps the Story list (which imports every Story) out of its JavaScript.
export const load: PageServerLoad = () => ({ stories });
