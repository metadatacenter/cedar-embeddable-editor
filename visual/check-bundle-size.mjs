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

// Baseline on 2026-08-07: 3,380,035 raw and 772,342 gzip-9 bytes.
//
// Raised from 3,230,000 / 765,000 for the MDC migration, which costs 190,966 raw
// and 19,620 gzip. That is what the MDC components weigh against the legacy ones
// they replace, measured on either side of the migration commit with nothing else
// changing — not drift, and not something a further pass could trim, since the
// legacy components no longer exist to go back to.
//
// The limits leave about 2% headroom. Raising one is an intentional product
// decision: update the baseline comment and explain the increase in the PR.
const LIMITS = {
  raw: 3_450_000,
  gzip: 790_000,
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
