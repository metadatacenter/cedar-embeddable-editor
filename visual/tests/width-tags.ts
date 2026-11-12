/**
 * Tags that keep a test to one of the two width projects. The config filters each project by them,
 * so a test outside its width is never scheduled there, rather than scheduled and skipped.
 *
 * A test tagged WIDTH_INDEPENDENT reads nothing the viewport width changes, or sets a viewport of its
 * own, so the narrow project would only repeat the desktop run. A test tagged NARROW_ONLY checks a
 * layout that exists only at a narrow width.
 */
export const WIDTH_INDEPENDENT = '@width-independent';
export const NARROW_ONLY = '@narrow-only';
