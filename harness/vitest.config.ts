import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
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
const TRANSFORM = [/cedar-embeddable-editor[\\/]src[\\/]/, /cedar-embeddable-editor[\\/]harness[\\/](src|stubs)[\\/]/];

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
    // CEE's handlers `import * as _ from 'lodash-es'`, but they live in
    // `../src`, and node resolution from there walks up to a repo root with no
    // node_modules. Point bare deps at the harness's own copy.
    if (source === 'lodash-es') {
      return path.resolve(here, 'node_modules/lodash-es/lodash.js');
    }
    // Same reason: `root` is the repo, so vitest looks for its own coverage
    // provider beside CEE's package.json rather than beside the harness's.
    if (source === '@vitest/coverage-v8') {
      return path.resolve(here, 'node_modules/@vitest/coverage-v8/dist/index.js');
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
  //
  // Written as `oxc` because Vite 8 transforms with oxc and ignores an `esbuild`
  // block outright. `decorator.legacy` is `experimentalDecorators`; the pair
  // `assumptions.setPublicClassFields` and
  // `typescript.removeClassFieldsWithoutInitializer` is `useDefineForClassFields:
  // false`, which oxc only honours when both are set. That keeps static class
  // fields (InputType, CedarModel, …) plain assignments, matching how CEE
  // actually compiles.
  oxc: {
    target: 'es2022',
    decorator: { legacy: true },
    assumptions: { setPublicClassFields: true },
    typescript: { removeClassFieldsWithoutInitializer: true },
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
    coverage: {
      provider: 'v8',
      // `.ts` explicitly. Without the extension Vitest 4 hands the component
      // `.html` templates to the coverage remapper, which parses them as
      // JavaScript and prints six "Unexpected JSX expression" stacks before
      // dropping them anyway.
      include: ['src/app/modules/shared/**/*.ts'],
      /**
       * Files this harness cannot load, so counting them measures nothing.
       *
       * The harness imports no Angular on purpose — that is what lets it survive a
       * framework upgrade untouched — so anything that reaches for Angular is
       * unreachable here by construction, not merely untested. Both translate
       * loaders import `@ngx-translate/core` and `@angular/common/http`. They sat at
       * 0% and pulled the `shared/util` floor to 89.71%, which failed `test:ci` for
       * a coverage gap that no test could ever close.
       *
       * They are covered where they can be: the browser suite serves an external
       * language map from `visual/generate-fixtures.mjs` and asserts both the
       * fetched map and the built-in fallback.
       *
       * `CEE-RUNBOOK.md` already makes this argument for the rest of `shared/` —
       * "the headline number for all of `shared/` is meaningless" — and this floor
       * had quietly acquired the same problem. Keep the list short: an entry here
       * must be unreachable to the harness, not just inconvenient to test.
       */
      exclude: [
        /*
         * CEE's own Angular specs, which are not source and are measured by the
         * unit suite that runs them. Stated rather than assumed: Vitest excluded
         * `*.spec.ts` by default until 4, where the `include` glob above started
         * pulling all five in at 0% — `template-markup-policy.spec.ts` by itself
         * took the `shared/util` floor from 90% to 78.72%.
         *
         * This entry is not an instance of the rule below. It removes test code
         * from a measurement of source, rather than excusing source the harness
         * cannot reach.
         */
        'src/app/modules/shared/**/*.spec.ts',
        'src/app/modules/shared/util/fallback-translate-loader.ts',
        'src/app/modules/shared/util/fallback-translate-loader-factory.ts',
        // Same rule, different dependency: the template rich-text policy needs a
        // DOM, and DOMPurify without one does not degrade — `sanitize` is not a
        // function. The harness can reach exactly one branch of that file, the
        // fail-closed guard, and `template-markup-policy-fallback.spec.ts` asserts
        // it. The allowlist itself is asserted under jsdom and in the browser.
        'src/app/modules/shared/util/template-markup-policy.ts',
      ],
      reporter: ['text'],
      /*
       * Aggregate thresholds for the headless domain directories, not per-file
       * gates. Angular components and REST/view models remain in the report for
       * visibility but do not dilute or satisfy these floors.
       *
       * Branches sit at 85 rather than 90 because Vitest 4 counts them
       * differently, not because the suite got worse. Vitest 4 dropped the old
       * V8 mapping for AST-aware remapping and offers no way back, and the same
       * source that cleared 90 everywhere under Vitest 1 now measures 90.62
       * (factory), 87.7 (handler), 86.6 (util) and 91.51 (validation). No test
       * was removed and no branch stopped being exercised — branches that the
       * old mapping never counted are now in the denominator.
       *
       * Uniform at 85 rather than tuned per directory, because a floor a
       * fraction under today's number is a tripwire for noise rather than for
       * regression. Statements stay at 90: the lowest is 94.98, so that floor
       * still bites.
       */
      thresholds: {
        'src/app/modules/shared/factory/**': { statements: 90, branches: 85 },
        'src/app/modules/shared/handler/**': { statements: 90, branches: 85 },
        'src/app/modules/shared/util/**': { statements: 90, branches: 85 },
        'src/app/modules/shared/validation/**': { statements: 90, branches: 85 },
      },
    },
  },
});
