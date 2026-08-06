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
 * An ES module entry that pulls in sibling chunks cannot be concatenated. Detect
 * that directly from the bytes rather than inferring it from a version number:
 * the question is what the file *is*, and a build flag or a future builder could
 * change the answer without changing anything we could look up.
 */
const importsSiblings = (file) => {
  const text = readFileSync(file, 'utf8');
  return /(?:^|[;}\s])(?:import|export)\s*(?:\{[^}]*\}|\*[^;]*?|[\w$]+)?\s*(?:from\s*)?["']\.\//m.test(text);
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

  // A `runtime.js` is a webpack tell, but the entry's own contents are the
  // authority — that is what actually decides whether joining is legal.
  const strategy = importsSiblings(entry) ? 'bundle' : 'concat';

  if (strategy === 'concat') {
    const inputs = ['runtime', 'polyfills', 'entry'].map((r) => found.get(r)).filter(Boolean);
    return { dir, strategy, entry, inputs };
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
