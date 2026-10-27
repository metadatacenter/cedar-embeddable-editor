#!/usr/bin/env node
/**
 * Compiles `shadow-root.scss` into the module `ShadowRootStyles` inserts into each of CEE's shadow
 * roots, before the Angular build that bundles it.
 *
 *   node scripts/compile-shadow-root-styles.mjs
 *   node scripts/compile-shadow-root-styles.mjs --development --watch ng serve
 *
 * `--watch` compiles, starts the command, and recompiles whenever a stylesheet the compiled one
 * depends on changes, until the command exits. `--development` gives the stylesheet the form
 * Angular's development build gives a component stylesheet: unminified, with an inline source map
 * that carries its Sass sources.
 *
 * The compilation repeats the one Angular's application builder gives a component stylesheet, so
 * the inserted stylesheet is the one Angular embedded in each component, byte for byte. It uses
 * the copies of Sass and esbuild that `@angular/build` itself runs, Sass's expanded output with the
 * workspace's include paths, and esbuild's bundling and minification for the browsers Angular
 * targets, with nesting lowered. Last, it marks each custom property with Angular's namespace
 * placeholder, as Angular's compiler does to component styles. Without `--development`, the output
 * is the optimized form a production build embeds.
 */
import { spawn } from 'node:child_process';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = path.join(root, 'src/app/modules/shared/directives/shadow-root.scss');
const output = path.join(root, 'dist-styles/shadow-root-css.ts');

const workspace = createRequire(path.join(root, 'package.json'));
const angularBuild = createRequire(workspace.resolve('@angular/build/package.json'));
const esbuild = angularBuild('esbuild');
const sass = angularBuild('sass');
// Angular's own browser support policy and its translation into esbuild targets.
const { getSupportedBrowsers, transformSupportedBrowsersToTargets } = workspace('@angular/build/private');

const args = process.argv.slice(2);
const development = args[0] === '--development';
if (development) args.shift();
const watching = args[0] === '--watch';
const command = watching ? args.slice(1) : [];

const angularJson = JSON.parse(await readFile(path.join(root, 'angular.json'), 'utf8'));
const { stylePreprocessorOptions = {} } = angularJson.projects['cedar-embeddable-editor'].architect.build.options;
const includePaths = (stylePreprocessorOptions.includePaths ?? []).map((include) => path.resolve(root, include));
const { silenceDeprecations, fatalDeprecations, futureDeprecations } = stylePreprocessorOptions.sass ?? {};

/** Whether Sass should look for `url` in a package, as Angular's resolver decides. */
function isPackageUrl(url) {
  return url.startsWith('pkg:') || (url.length > 0 && !/^[./\\]/.test(url) && !url.includes(':'));
}

/** Compiles each Sass stylesheet esbuild loads, resolving imports through esbuild as Angular does. */
const sassPlugin = {
  name: 'cee-shadow-root-sass',
  setup(build) {
    const resolve = (url, resolveDir) =>
      build.resolve(url.startsWith('pkg:') ? url.slice('pkg:'.length) : url, { kind: 'import-rule', resolveDir });
    build.onLoad({ filter: /\.s[ac]ss$/ }, async ({ path: file }) => {
      const { css, sourceMap, loadedUrls } = await sass.compileStringAsync(await readFile(file, 'utf8'), {
        url: pathToFileURL(file),
        style: 'expanded',
        syntax: file.endsWith('.sass') ? 'indented' : 'scss',
        loadPaths: includePaths,
        sourceMap: development,
        sourceMapIncludeSources: development,
        silenceDeprecations,
        fatalDeprecations,
        futureDeprecations,
        quietDeps: true,
        importers: [
          {
            async findFileUrl(url, { containingUrl }) {
              const containing = containingUrl?.protocol === 'file:' ? fileURLToPath(containingUrl) : undefined;
              const resolveDir = containing ? path.dirname(containing) : root;
              const resolved = await resolve(url, resolveDir);
              if (resolved.path) return pathToFileURL(resolved.path);
              if (!isPackageUrl(url)) return null;
              // A deep import into a package that declares no export for it.
              const segments = (url.startsWith('pkg:') ? url.slice('pkg:'.length) : url).split('/');
              const nameLength = segments[0].startsWith('@') ? 2 : 1;
              const manifest = await resolve(`${segments.slice(0, nameLength).join('/')}/package.json`, resolveDir);
              return manifest.path
                ? pathToFileURL(path.join(path.dirname(manifest.path), ...segments.slice(nameLength)))
                : null;
            },
          },
        ],
      });
      // esbuild chains a source map given in a trailing comment, the form in which Angular passes Sass's on.
      const map = sourceMap
        ? `\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,${Buffer.from(JSON.stringify(sourceMap)).toString('base64')} */`
        : '';
      return { loader: 'css', contents: css + map, watchFiles: loadedUrls.map((url) => fileURLToPath(url)) };
    });
  },
};

// Angular's compiler gives every custom property a component stylesheet declares or reads a
// namespace placeholder, and drops the `global` marker from one declared global. This is its
// `namespaceCssVariables`, from `@angular/compiler`.
const customProperty = /(var\(\s*|@property\s+)?(--(?:[a-zA-Z0-9_-]|[^\x00-\x7F])+)(\s*:)?/g;
function namespaceCustomProperties(css) {
  return css.replace(customProperty, (match, prefix, name, colon) => {
    if (!prefix && !colon) return match;
    const namespaced = name.startsWith('--global--')
      ? `--${name.slice('--global--'.length)}`
      : `--%NS%${name.slice(2)}`;
    return (prefix ?? '') + namespaced + (colon ?? '');
  });
}

/** Writes the compiled stylesheet as a module, replacing the file only when its content changes. */
async function emit(css) {
  const module =
    `// Generated by scripts/compile-shadow-root-styles.mjs from ${path.relative(root, entry)}.\n` +
    `export const SHADOW_ROOT_CSS = ${JSON.stringify(namespaceCustomProperties(css))};\n`;
  const current = await readFile(output, 'utf8').catch(() => null);
  if (current === module) return;
  await mkdir(path.dirname(output), { recursive: true });
  // Builds that run side by side may compile at the same time, so each writes a file of its own
  // and renames it into place.
  const partial = `${output}.${process.pid}`;
  await writeFile(partial, module);
  await rename(partial, output);
}

let built = false;
const context = await esbuild.context({
  absWorkingDir: root,
  entryPoints: [entry],
  bundle: true,
  write: false,
  outdir: root,
  logLevel: 'silent',
  minify: !development,
  sourcemap: development ? 'inline' : false,
  sourcesContent: development,
  platform: 'browser',
  target: transformSupportedBrowsersToTargets(getSupportedBrowsers(root, { warn: (text) => console.warn(text) })),
  conditions: ['style', 'sass', 'production'],
  mainFields: ['style', 'sass'],
  resolveExtensions: [],
  supported: { nesting: false },
  plugins: [
    sassPlugin,
    {
      name: 'cee-shadow-root-module',
      setup(build) {
        build.onEnd(async (result) => {
          for (const message of await esbuild.formatMessages(result.errors, { kind: 'error' })) console.error(message);
          if (result.errors.length) return;
          await emit(result.outputFiles.find((file) => file.path.endsWith('.css')).text);
          if (built && watching) console.log('Recompiled the shadow-root stylesheet.');
          built = true;
        });
      },
    },
  ],
});

await context.rebuild().catch(() => undefined);
if (!built) {
  await context.dispose();
  process.exit(1);
}
if (!watching) {
  await context.dispose();
} else {
  await context.watch();
  const child = spawn(command[0], command.slice(1), { stdio: 'inherit' });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  child.on('exit', async (code, signal) => {
    await context.dispose();
    process.exit(code ?? (signal ? 1 : 0));
  });
}
