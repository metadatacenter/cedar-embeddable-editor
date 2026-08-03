/**
 * Refuse to run the visual suite against a stale bundle.
 *
 * The suite serves `public/`, which is a *copy* of `../dist/` made by
 * `npm run bundle`. Building the app does not update it. That gap is invisible
 * while it matters most: the suite still runs, still passes, and reports 42
 * green against code that is no longer the code — which is exactly what
 * happened while chasing a widget bug, where a fix was declared not to work on
 * the strength of a run against the previous bundle.
 *
 * A green run has to mean something. If `dist/` is newer than the copy, this
 * exits non-zero and says what to do.
 */
import { statSync, existsSync } from 'node:fs';

const COPY = new URL('./public/cedar-embeddable-editor.js', import.meta.url);
const PARTS = ['runtime.js', 'polyfills.js', 'main.js'].map(
  (f) => new URL(`../dist/cedar-embeddable-editor/${f}`, import.meta.url),
);

const die = (message) => {
  console.error(`\n  visual: ${message}\n`);
  process.exit(1);
};

if (!existsSync(COPY)) {
  die('public/cedar-embeddable-editor.js is missing. Run: npm run bundle');
}

const missing = PARTS.filter((p) => !existsSync(p));
if (missing.length) {
  // No dist at all is not the failure this guard is for — the copy is all the
  // suite actually needs, and a checkout that never built can still run it.
  console.warn('  visual: ../dist is absent; testing whatever is in public/. Build the app to refresh it.');
  process.exit(0);
}

const copiedAt = statSync(COPY).mtimeMs;
const builtAt = Math.max(...PARTS.map((p) => statSync(p).mtimeMs));

if (builtAt > copiedAt) {
  const minutes = Math.round((builtAt - copiedAt) / 60000);
  die(
    `../dist is ${minutes} minute(s) newer than public/cedar-embeddable-editor.js.\n` +
      '  The suite serves the copy, so this run would test the previous build.\n' +
      '  Run: npm run bundle',
  );
}
