/**
 * Locate the built app in `../dist` and decide how to turn it into the single
 * file an embedder downloads.
 *
 * CEE ships one script. Today's build emits three standalone IIFEs that only
 * have to be joined in load order — `runtime.js`, `polyfills.js`, `main.js`, the
 * artifact README.md:67 tells embedders to build. That join is a property of the
 * *webpack* builder, not of CEE. Angular's esbuild `application` builder emits
 * something structurally different: hashed filenames, an output subdirectory,
 * and an ES module graph whose entry imports sibling chunks. Concatenating those
 * produces a file with dangling `import` statements — broken, and broken in a
 * way that still looks like a bundle.
 *
 * So the shape of the output is not the only thing that moves; the operation
 * does. This module answers both questions at once — which files, and joined how
 * — and is the single place that knows anything about builder output. The
 * freshness guard, the size gate and the bundle step all read it from here.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_DIST = fileURLToPath(new URL('../dist/cedar-embeddable-editor', import.meta.url));

/**
 * Roles in load order. `runtime` must precede everything (it defines the chunk
 * registry the others register into) and the entry must come last.
 */
const ROLES = [
  { role: 'runtime', pattern: /^runtime(\.[0-9a-f]+)?\.js$/ },
  { role: 'polyfills', pattern: /^polyfills(-[0-9A-Z]+|\.[0-9a-f]+)?\.js$/ },
  { role: 'entry', pattern: /^main(-[0-9A-Z]+|\.[0-9a-f]+)?\.js$/ },
];

/**
 * The esbuild builder nests output under `browser/`; webpack writes flat. Prefer
 * the nested directory when it exists so a half-cleaned `dist` from a previous
 * builder cannot shadow the current one.
 */
const findOutputDir = (dist) => {
  if (!existsSync(dist)) return null;
  const nested = join(dist, 'browser');
  if (existsSync(nested) && readdirSync(nested).some((f) => f.endsWith('.js'))) return nested;
  return readdirSync(dist).some((f) => f.endsWith('.js')) ? dist : null;
};

/**
 * Whether a file can be dropped into a scope it shares with others.
 *
 * This is the question concatenation actually turns on, and asking a different
 * one cost a working artifact. The first version of this asked whether the entry
 * imported sibling chunks, on the reasoning that dangling `import` statements are
 * what breaks a joined file. The `application` builder emits an entry that
 * imports nothing — so that test said "concatenate", and the result loaded, ran,
 * and died inside Angular with `Cannot read properties of undefined (reading
 * 'lFrame')`. Each file alone was fine; both together were not.
 *
 * The reason is scope. Webpack wrapped its chunks in an IIFE, so joining them
 * shared nothing. The `application` builder emits ES modules, whose top-level
 * declarations are module-scoped and are meant to stay that way — `polyfills.js`
 * opens `var ce=globalThis`, `main.js` opens `var zk=Object.create`, both from
 * the same minifier alphabet across megabytes. Concatenated into one classic
 * script those become globals, and they collide.
 *
 * So `concat` now needs positive proof that every input keeps to itself, and
 * anything else falls to `bundle`, which re-wraps each file through esbuild and
 * is always correct. That direction matters more than the test: `bundle` is
 * merely slower, while a wrong `concat` produces a plausible file that fails
 * only when something runs it.
 */
const selfContained = (file) => {
  const text = readFileSync(file, 'utf8');
  // Past a banner comment and a directive prologue, a self-wrapping bundle opens
  // its IIFE immediately. The prologue is not incidental: webpack emits
  // `"use strict";` ahead of the wrapper in `polyfills.js` and nowhere else, so a
  // test that does not allow for it reads the webpack output as unjoinable and
  // quietly re-bundles an artifact that concatenation already produced correctly.
  const code = text
    .replace(/^(?:\s+|\/\*[\s\S]*?\*\/|\/\/[^\n]*(?:\n|$))+/, '')
    .replace(/^(?:(["'])use strict\1\s*;\s*)+/, '');
  return /^[;!+~-]*\(/.test(code) || /^!?function\s*[(*]/.test(code);
};

/**
 * @param {string} [dist] build output root; defaults to the app's `dist`.
 * @returns {{dir: string, strategy: 'concat'|'bundle', entry: string, inputs: string[]}}
 *   `inputs` is every file whose content lands in the shipped artifact, in load
 *   order for `concat` and as the freshness-relevant set for `bundle`.
 * @throws if `dist` holds no recognizable build.
 */
export const resolveBuildOutput = (dist = DEFAULT_DIST) => {
  const dir = findOutputDir(dist);
  if (!dir) {
    throw new Error(`no built app in ${dist}. Run: npm run build:production`);
  }

  const present = readdirSync(dir);
  const found = new Map();
  for (const { role, pattern } of ROLES) {
    const matches = present.filter((f) => pattern.test(f)).sort();
    if (matches.length > 1) {
      throw new Error(
        `ambiguous ${role} in ${dir}: ${matches.join(', ')}.\n` +
          '  Stale output from a previous build is mixing with the current one. Delete dist and rebuild.',
      );
    }
    if (matches.length === 1) found.set(role, join(dir, matches[0]));
  }

  const entry = found.get('entry');
  if (!entry) {
    throw new Error(`no entry (main*.js) in ${dir}. Run: npm run build:production`);
  }

  // A `runtime.js` is a webpack tell, but the files' own contents are the
  // authority — that is what actually decides whether joining is legal. Every
  // input has to be self-contained, not just the entry: the collision that
  // motivated this was between `polyfills.js` and `main.js`.
  const joinable = ['runtime', 'polyfills', 'entry'].map((r) => found.get(r)).filter(Boolean);
  const strategy = joinable.every(selfContained) ? 'concat' : 'bundle';

  if (strategy === 'concat') {
    return { dir, strategy, entry, inputs: joinable };
  }

  // Under `bundle` the entry's import graph reaches the chunks, so esbuild
  // resolves them itself. They still belong in `inputs`: a lazy chunk changing
  // is a reason to consider the copy stale.
  const chunks = present.filter((f) => /\.js$/.test(f)).map((f) => join(dir, f));
  const polyfills = found.get('polyfills');
  return {
    dir,
    strategy,
    entry,
    inputs: [...new Set([...(polyfills ? [polyfills] : []), entry, ...chunks])],
  };
};

/** Newest mtime across everything that feeds the artifact. */
export const newestInputMtime = (inputs) => Math.max(...inputs.map((p) => statSync(p).mtimeMs));

/** Stable, path-independent description of the inputs, for the manifest. */
export const describeInputs = (dir, inputs) =>
  inputs.map((p) => p.slice(dir.length + 1)).sort();
