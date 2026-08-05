/**
 * Build `public/cedar-embeddable-editor.js` — the single file the visual suite
 * serves and an embedder downloads.
 *
 * Replaces a `cat` of three hardcoded filenames. The files it joins, and whether
 * joining is even the right operation, come from resolve-build-output.mjs. A
 * sidecar manifest records what went in so the freshness guard and the size gate
 * can check the copy without re-deriving it.
 *
 * Usable as a module — `produceBundle()` returns the bytes and manifest without
 * writing — so the packaging step itself is testable against a synthetic build.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { DEFAULT_DIST, describeInputs, newestInputMtime, resolveBuildOutput } from './resolve-build-output.mjs';

const OUT = fileURLToPath(new URL('./public/cedar-embeddable-editor.js', import.meta.url));
const MANIFEST = fileURLToPath(new URL('./public/bundle-manifest.json', import.meta.url));

/**
 * Flatten an ES module entry and its sibling chunks into one classic script.
 *
 * Only reached under the esbuild `application` builder. `iife` matters: the
 * artifact is loaded with a plain `<script>` by embedders who are not obliged to
 * use `type="module"`, and a top-level `import` would fail there.
 */
const flatten = async (entry) => {
  let esbuild;
  try {
    esbuild = await import('esbuild');
  } catch {
    throw new Error(
      'the build output is an ES module graph, which needs esbuild to flatten into one script.\n' +
        '  Run: npm --prefix visual install',
    );
  }
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: 'iife',
    // The input is already minified, downleveled and tree-shaken by Angular.
    // Re-minifying would only add risk and obscure the size comparison.
    minify: false,
    write: false,
    logLevel: 'silent',
    platform: 'browser',
  });
  return Buffer.from(result.outputFiles[0].contents);
};

/**
 * @param {string} [dist] build output root; defaults to the app's `dist`.
 * @returns {Promise<{bundle: Buffer, manifest: object, strategy: string, inputs: string[]}>}
 */
export const produceBundle = async (dist = DEFAULT_DIST) => {
  const { dir, strategy, entry, inputs } = resolveBuildOutput(dist);

  let bundle;
  if (strategy === 'concat') {
    bundle = Buffer.concat(inputs.map((file) => readFileSync(file)));
  } else {
    // Polyfills are a separate entry rather than an import of main, so they are
    // flattened separately and kept first.
    const polyfills = inputs.find((p) => /polyfills/.test(p));
    const parts = [];
    if (polyfills) parts.push(await flatten(polyfills));
    parts.push(await flatten(entry));
    bundle = Buffer.concat(parts);
  }

  return {
    bundle,
    strategy,
    inputs,
    manifest: {
      strategy,
      inputs: describeInputs(dir, inputs),
      builtAt: newestInputMtime(inputs),
      bytes: bundle.byteLength,
      sha256: createHash('sha256').update(bundle).digest('hex'),
    },
  };
};

const main = async () => {
  const { bundle, manifest, strategy, inputs } = await produceBundle();
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, bundle);
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `  bundle: ${strategy} of ${inputs.length} file(s) -> ${bundle.byteLength.toLocaleString('en-US')} bytes`,
  );
};

// Only run when invoked directly, so importing this for tests has no side effect.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`\n  bundle: ${error.message ?? error}\n`);
    process.exit(1);
  });
}
