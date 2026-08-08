/**
 * Enforce the size of the artifact an embedder actually downloads.
 *
 * Angular's `initial` budget is useful but measures emitted chunks before CEE's
 * packaging step. CEE ships one file, so this measures that file — raw and
 * gzip-9.
 *
 * It reads `public/cedar-embeddable-editor.js` rather than rebuilding the byte
 * sequence in memory. Reproducing it was only possible while packaging was a
 * concatenation of three known files; how the parts are joined is now the
 * build's business, and the shipped file is what the limit is actually about.
 * check-bundle-fresh.mjs is what guarantees that file is current and unmodified
 * — it compares a recorded sha256 — so this gate can trust it without
 * re-deriving it.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync, constants as zlibConstants } from 'node:zlib';

const COPY = fileURLToPath(new URL('./public/cedar-embeddable-editor.js', import.meta.url));

// Baseline on 2026-08-08: 3,471,865 raw and 798,253 gzip-9 bytes, at Angular 21.
//
// Raised three times across the Angular march. MDC cost 190,966 raw and 19,620
// gzip — what the MDC components weigh against the legacy ones they replace,
// measured either side of that commit. Angular 16→17 added 42,632 raw. Angular 18
// gave 78,423 back. Angular 20 and 21 together took 84,748 raw and 13,965 gzip.
//
// The gzip figure is the binding one now, not raw: at Angular 21 it came within
// 1,747 bytes of its previous ceiling while raw still had 43KB spare. CI also
// measures gzip a little larger than a developer machine does — 786,570 against
// 784,252 for the same bundle — so headroom here has to cover that difference
// too, which is why this raise is to 830,000 rather than the ~815,000 that two
// percent would give.
//
// The limits leave headroom deliberately. Raising one is an intentional product
// decision: update the baseline comment and explain the increase in the PR.
//
// Worth saying plainly, since this is the third raise: this is a decision to let
// the framework upgrade cost bytes, taken each time on the evidence that the
// growth is the framework's and not a regression in CEE. The single-file bundle
// is now 3.4MB, and whether that is still the right artifact deserves asking on
// its own merits rather than one increment at a time.
const LIMITS = {
  raw: 3_560_000,
  gzip: 830_000,
};

const die = (message) => {
  console.error(`\n  bundle-size: ${message}\n`);
  process.exit(1);
};

let bundle;
try {
  bundle = readFileSync(COPY);
} catch (error) {
  die('cannot read public/cedar-embeddable-editor.js. Run: npm run build:production && npm run bundle\n' + error);
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
