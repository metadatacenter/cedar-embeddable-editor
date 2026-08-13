/**
 * Refuse to run the visual suite against a stale bundle.
 *
 * The suite serves `public/`, which is a *copy* of the build output made by
 * `npm run bundle`. Building the app does not update it. That gap is invisible
 * while it matters most: the suite still runs, still passes, and reports green
 * against code that is no longer the code — which is exactly what happened while
 * chasing a widget bug, where a fix was declared not to work on the strength of
 * a run against the previous bundle.
 *
 * A green run has to mean something. If the build output is newer than the copy,
 * or was produced by a different builder than the copy was made from, this exits
 * non-zero and says what to do.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describeInputs, newestInputMtime, resolveBuildOutput } from './resolve-build-output.mjs';

const COPY = fileURLToPath(new URL('./public/cedar-embeddable-editor.js', import.meta.url));
const MANIFEST = fileURLToPath(new URL('./public/bundle-manifest.json', import.meta.url));

const die = (message) => {
  console.error(`\n  visual: ${message}\n`);
  process.exit(1);
};

if (!existsSync(COPY)) {
  die('public/cedar-embeddable-editor.js is missing. Run: npm run bundle');
}

let output;
try {
  output = resolveBuildOutput();
} catch (error) {
  // No dist at all is not the failure this guard is for — the copy is all the
  // suite actually needs, and a checkout that never built can still run it.
  console.warn(`  visual: ${error.message.split('\n')[0]}; testing whatever is in public/.`);
  process.exit(0);
}

const copiedAt = statSync(COPY).mtimeMs;
const builtAt = newestInputMtime(output.inputs);

if (builtAt > copiedAt) {
  const minutes = Math.round((builtAt - copiedAt) / 60000);
  die(
    `the build output is ${minutes} minute(s) newer than public/cedar-embeddable-editor.js.\n` +
      '  The suite serves the copy, so this run would test the previous build.\n' +
      '  Run: npm run bundle',
  );
}

/**
 * Timestamps alone stop being sufficient once the builder can change underneath
 * the harness. A builder switch rewrites the output shape without necessarily
 * making anything newer than the copy, so a stale copy made from the old shape
 * would pass the mtime check and then be quietly tested for the rest of the
 * upgrade — the same class of false green this guard exists to prevent.
 */
if (!existsSync(MANIFEST)) {
  die('public/bundle-manifest.json is missing, so the copy cannot be attributed to a build. Run: npm run bundle');
}

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const current = describeInputs(output.dir, output.inputs);

if (manifest.strategy !== output.strategy) {
  die(
    `the copy was joined by the "${manifest.strategy}" strategy but the build output now needs "${output.strategy}".\n` +
      '  The builder changed. Run: npm run bundle',
  );
}

if (JSON.stringify(manifest.inputs) !== JSON.stringify(current)) {
  die(
    'the build output no longer matches the files the copy was made from.\n' +
      `  copy:  ${manifest.inputs.join(', ')}\n` +
      `  build: ${current.join(', ')}\n` +
      '  Run: npm run bundle',
  );
}

const digest = createHash('sha256').update(readFileSync(COPY)).digest('hex');
if (manifest.sha256 !== digest) {
  die('public/cedar-embeddable-editor.js has changed since it was built. Run: npm run bundle');
}
