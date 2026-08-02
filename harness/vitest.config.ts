import { defineConfig, Plugin } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Modules Vite must transform rather than hand to node as-is.
 *
 * Anything vite-node externalizes gets loaded raw, so TypeScript reaches
 * node's vm and dies on the first `import` with "Invalid or unexpected token".
 * Both CEE's source and the harness's own code (including the stubs, which are
 * resolved to absolute paths by the plugin below) have to be listed.
 *
 * Keep this narrow. Inlining everything (`/.*​/`) also inlines `vitest` itself,
 * which hands the spec files a second copy of `describe`/`it` that the runner
 * never sees — the suite then "passes" having collected zero tests.
 */
const TRANSFORM = [
  /cedar-embeddable-editor[\\/]src[\\/]/,
  /cedar-embeddable-editor[\\/]harness[\\/](src|stubs)[\\/]/,
];

/**
 * Redirect two modules to local stubs.
 *
 * This is a `resolveId` plugin rather than a `resolve.alias` entry because the
 * import we need to intercept is *relative*
 * (`../components/.../cedar-embeddable-metadata-editor.component`, from
 * data-object-util.ts). Vite resolves relative specifiers against the importer's
 * directory before alias regexes get a look in, so an alias silently never
 * fires. A `pre`-enforced resolveId hook runs first and sees the raw specifier.
 */
const ceeStubs = (): Plugin => ({
  name: 'cee-stubs',
  enforce: 'pre',
  resolveId(source: string) {
    // Keep the harness Angular-free. See stubs/angular-core.ts.
    if (source === '@angular/core') {
      return path.resolve(here, 'stubs/angular-core.ts');
    }
    // Cut the DataObjectUtil -> editor component edge. See stubs/editor-component.ts.
    // Anchored on a full path segment so it does NOT match `...-wrapper.component`.
    if (/(^|\/)cedar-embeddable-metadata-editor\.component$/.test(source)) {
      return path.resolve(here, 'stubs/editor-component.ts');
    }
    // CEE's handlers `import * as _ from 'lodash-es'`, but they live in
    // `../src`, and node resolution from there walks up to a repo root with no
    // node_modules. Point bare deps at the harness's own copy.
    if (source === 'lodash-es') {
      return path.resolve(here, 'node_modules/lodash-es/lodash.js');
    }
    return null;
  },
});

export default defineConfig({
  // Root is the CEE repo, not `harness/` — the files under test are CEE's own
  // source, so the repo is the honest root.
  root: path.resolve(here, '..'),
  plugins: [ceeStubs()],
  resolve: {
    alias: [
      {
        find: '@cee',
        replacement: path.resolve(here, '../src/app/modules/shared'),
      },
    ],
  },
  // Without this, vite-node externalizes CEE's `.ts` files and hands them to
  // node's vm untransformed — which fails on the first `import` with a bare
  // "Invalid or unexpected token". Forcing them through Vite's transform is the
  // whole trick to running Angular-era TypeScript headlessly.
  //
  // Keep the pattern narrow. Inlining everything (`/.*/`) also inlines `vitest`,
  // which gives the spec files a second copy of `describe`/`it` that the runner
  // never sees — the suite then "passes" by collecting zero tests.
  // CEE's domain services carry `@Injectable()`. esbuild only lowers decorators
  // when `experimentalDecorators` is on, and it discovers that from the nearest
  // tsconfig — which for files under `src/` is the repo's `tsconfig.json`, where
  // the flag is absent (it lives in `tsconfig.base.json`). Without this, the
  // decorator survives transform and node dies on `@__vite_ssr_import_0__...`.
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        // Matches how CEE actually compiles, so static class fields
        // (InputType, CedarModel, …) stay plain assignments.
        useDefineForClassFields: false,
        target: 'es2022',
      },
    },
  },
  ssr: {
    noExternal: TRANSFORM,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['harness/test/**/*.spec.ts'],
    server: {
      deps: {
        inline: TRANSFORM,
      },
    },
    // The generator builds a few hundred templates; give the suite room.
    testTimeout: 30_000,
  },
});
