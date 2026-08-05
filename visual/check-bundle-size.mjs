/**
 * Enforce the size of the artifact an embedder actually downloads.
 *
 * Angular's `initial` budget is useful but measures emitted chunks before CEE's
 * packaging step. CEE ships one concatenated file, so this check rebuilds that
 * exact byte sequence in memory and measures both its raw and gzip-9 sizes.
 */
import { readFileSync } from 'node:fs';
import { gzipSync, constants as zlibConstants } from 'node:zlib';

const PARTS = ['runtime.js', 'polyfills.js', 'main.js'].map(
  (file) => new URL(`../dist/cedar-embeddable-editor/${file}`, import.meta.url),
);
const COPY = new URL('./public/cedar-embeddable-editor.js', import.meta.url);

// Baseline on 2026-08-04: 3,167,000 raw and 749,628 gzip-9 bytes.
// The limits leave about 2% headroom. Raising one is an intentional product
// decision: update the baseline comment and explain the increase in the PR.
const LIMITS = {
  raw: 3_230_000,
  gzip: 765_000,
};

const die = (message) => {
  console.error(`\n  bundle-size: ${message}\n`);
  process.exit(1);
};

let bundle;
let copy;
try {
  bundle = Buffer.concat(PARTS.map((part) => readFileSync(part)));
  copy = readFileSync(COPY);
} catch (error) {
  die('cannot read the production bundle. Run npm run build:production and npm --prefix visual run bundle.\n' + error);
}

if (!bundle.equals(copy)) {
  die('visual/public/cedar-embeddable-editor.js does not match runtime.js + polyfills.js + main.js.');
}

const sizes = {
  raw: bundle.byteLength,
  gzip: gzipSync(bundle, { level: zlibConstants.Z_BEST_COMPRESSION }).byteLength,
};

const format = (bytes) => `${bytes.toLocaleString('en-US')} bytes`;
for (const kind of ['raw', 'gzip']) {
  const delta = LIMITS[kind] - sizes[kind];
  console.log(
    `  bundle-size: ${kind.padEnd(4)} ${format(sizes[kind])} / ${format(LIMITS[kind])} (${format(delta)} free)`,
  );
  if (delta < 0) {
    die(`${kind} bundle is ${format(-delta)} over its ${format(LIMITS[kind])} limit.`);
  }
}
