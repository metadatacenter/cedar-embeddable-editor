/**
 * Tests for the packaging layer — the part of the harness that turns a build into
 * the single file an embedder downloads.
 *
 * This exists because the packaging step is about to be the thing that breaks.
 * The Angular upgrade replaces the webpack builder with esbuild, which changes
 * the output directory, the filenames, and — the part that actually matters —
 * whether the emitted files can be concatenated at all. Those are exactly the
 * conditions no current build can reproduce, so they are synthesized here: each
 * test writes a fake `dist` in the shape a given builder produces and asserts
 * that packaging still yields one self-contained classic script.
 *
 * Run: npm --prefix visual run test:packaging
 */
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { produceBundle } from './make-bundle.mjs';
import { resolveBuildOutput } from './resolve-build-output.mjs';

const temps = [];
const scratch = () => {
  const dir = mkdtempSync(join(tmpdir(), 'cee-packaging-'));
  temps.push(dir);
  return dir;
};
after(() => temps.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

/** A `dist` in the shape the webpack `browser` builder emits: flat, unhashed, IIFEs. */
const webpackDist = () => {
  const dist = scratch();
  writeFileSync(join(dist, 'runtime.js'), '(function(){window.__runtime=1})();\n');
  writeFileSync(join(dist, 'polyfills.js'), '(function(){window.__polyfills=1})();\n');
  writeFileSync(join(dist, 'main.js'), '(function(){window.__main=1})();\n');
  // Emitted for angular.json's `scripts` array and loaded by the dev page, but
  // deliberately not part of the documented embeddable artifact.
  writeFileSync(join(dist, 'scripts.js'), '(function(){window.__shim=1})();\n');
  writeFileSync(join(dist, 'index.html'), '<html></html>');
  return dist;
};

/**
 * A `dist` in the shape the esbuild `application` builder emits: nested under
 * `browser/`, hashed filenames, no runtime, and an entry that imports chunks.
 */
const esbuildDist = () => {
  const dist = scratch();
  const browser = join(dist, 'browser');
  mkdirSync(browser);
  writeFileSync(join(browser, 'chunk-4WYQ2LJ6.js'), 'export const shared = 41;\n');
  writeFileSync(
    join(browser, 'main-7BQ3XKZA.js'),
    'import{shared as s}from"./chunk-4WYQ2LJ6.js";window.__main=s+1;\n',
  );
  writeFileSync(join(browser, 'polyfills-FVDXCUW7.js'), 'window.__polyfills=1;\n');
  writeFileSync(join(browser, 'index.html'), '<html></html>');
  return dist;
};

describe('resolveBuildOutput', () => {
  it('reads the webpack shape as a concatenation, in load order', () => {
    const { strategy, inputs } = resolveBuildOutput(webpackDist());
    assert.equal(strategy, 'concat');
    assert.deepEqual(
      inputs.map((p) => p.split('/').pop()),
      ['runtime.js', 'polyfills.js', 'main.js'],
      'runtime must load before polyfills before the entry',
    );
  });

  it('excludes scripts.js from the embeddable artifact', () => {
    const { inputs } = resolveBuildOutput(webpackDist());
    assert.ok(!inputs.some((p) => p.endsWith('scripts.js')));
  });

  it('reads the esbuild shape as a bundle, from the nested output directory', () => {
    const { strategy, dir, entry, inputs } = resolveBuildOutput(esbuildDist());
    assert.equal(strategy, 'bundle', 'an entry that imports siblings cannot be concatenated');
    assert.ok(dir.endsWith('/browser'));
    assert.ok(entry.endsWith('main-7BQ3XKZA.js'), 'the hashed entry must still be found');
    assert.ok(
      inputs.some((p) => p.includes('chunk-')),
      'lazy chunks belong to the freshness set even though esbuild resolves them itself',
    );
  });

  it('refuses to guess when stale output shadows the current build', () => {
    const dist = webpackDist();
    writeFileSync(join(dist, 'main-7BQ3XKZA.js'), 'window.__stale=1;\n');
    assert.throws(() => resolveBuildOutput(dist), /ambiguous entry/);
  });

  it('names the remedy when there is no build at all', () => {
    assert.throws(() => resolveBuildOutput(scratch()), /Run: npm run build:production/);
  });
});

describe('produceBundle', () => {
  it('concatenates the webpack shape verbatim', async () => {
    const { bundle, manifest } = await produceBundle(webpackDist());
    assert.equal(
      bundle.toString(),
      '(function(){window.__runtime=1})();\n(function(){window.__polyfills=1})();\n(function(){window.__main=1})();\n',
    );
    assert.equal(manifest.strategy, 'concat');
    assert.equal(manifest.bytes, bundle.byteLength);
  });

  it('flattens the esbuild shape into one script with no dangling imports', async () => {
    const { bundle, manifest } = await produceBundle(esbuildDist());
    const text = bundle.toString();
    assert.equal(manifest.strategy, 'bundle');
    assert.ok(
      !/(^|[;}\s])import\s*[{*"']/.test(text),
      'a concatenation would have left an import statement here, and the artifact would not load',
    );
    assert.ok(text.includes('window.__polyfills'), 'polyfills must survive, and come first');
    assert.ok(text.indexOf('window.__polyfills') < text.indexOf('window.__main'));
  });

  it('produces an esbuild-shaped artifact that actually evaluates', async () => {
    const { bundle } = await produceBundle(esbuildDist());
    // The chunk contributes 41 and the entry adds 1. If the import graph were
    // mishandled, this either throws or yields the wrong value.
    const window = {};
    new Function('window', bundle.toString())(window);
    assert.equal(window.__main, 42);
    assert.equal(window.__polyfills, 1);
  });

  it('records a digest that changes with the bytes', async () => {
    const a = await produceBundle(webpackDist());
    const b = await produceBundle(esbuildDist());
    assert.match(a.manifest.sha256, /^[0-9a-f]{64}$/);
    assert.notEqual(a.manifest.sha256, b.manifest.sha256);
  });
});
