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

// Baseline on 2026-08-07: 3,445,176 raw and 781,612 gzip-9 bytes, at Angular 17.
//
// The march has moved this twice. The MDC migration cost 190,966 raw and 19,620
// gzip — what the MDC components weigh against the legacy ones they replace,
// measured either side of that commit with nothing else changing, and not
// something a later pass could trim since the legacy components are gone. Angular
// 16 to 17 then added a further 42,632 raw and 6,226 gzip, which is the framework
// rather than CEE.
//
// The limits leave about 2% headroom. Raising one is an intentional product
// decision: update the baseline comment and explain the increase in the PR.
//
// Worth saying plainly, since three raises in one march start to look like a
// ratchet: this is a decision to let the framework upgrade cost bytes, taken each
// time on the evidence that the growth is the framework's and not a regression in
// CEE. If the remaining hops keep adding, the question stops being "raise it
// again?" and becomes whether the single-file bundle is still the right artifact.
const LIMITS = {
  raw: 3_515_000,
  gzip: 800_000,
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
