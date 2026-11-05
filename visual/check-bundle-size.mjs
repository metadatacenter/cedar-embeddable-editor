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

// Measured 2026-11-05 before modular-model adoption: standalone 2,362,227 raw /
// 629,899 gzip-9; host fonts 2,239,571 / 537,062. Keep separate ceilings so the
// host-font entry cannot silently regain embedded fonts. Changes need measured
// evidence; Angular's initial budget does not measure the final packaged file.
const LIMITS = {
  standalone: { raw: 2_400_000, gzip: 660_000 },
  hostFonts: { raw: 2_280_000, gzip: 560_000 },
};

const die = (message) => {
  console.error(`\n  bundle-size: ${message}\n`);
  process.exit(1);
};

for (const file of [COPY, COPY.replace('.js', '.host-fonts.js')]) {
  const limits = file.endsWith('.host-fonts.js') ? LIMITS.hostFonts : LIMITS.standalone;
  console.log(`  bundle-size: ${file.split('/').pop()}`);
  let bundle;
  try {
    bundle = readFileSync(file);
  } catch (error) {
    die('cannot read public/cedar-embeddable-editor.js. Run: npm run build:production && npm run bundle\n' + error);
  }

  const sizes = {
    raw: bundle.byteLength,
    gzip: gzipSync(bundle, { level: zlibConstants.Z_BEST_COMPRESSION }).byteLength,
  };

  const format = (bytes) => `${bytes.toLocaleString('en-US')} bytes`;
  for (const kind of ['raw', 'gzip']) {
    const delta = limits[kind] - sizes[kind];
    console.log(
      `  bundle-size: ${kind.padEnd(4)} ${format(sizes[kind])} / ${format(limits[kind])} (${format(delta)} free)`,
    );
    if (delta < 0) {
      die(`${kind} bundle is ${format(-delta)} over its ${format(limits[kind])} limit.`);
    }
  }
}
