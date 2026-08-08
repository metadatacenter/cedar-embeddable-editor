import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Vitest for the specs under `src/`.
 *
 * These ran on Karma. The Angular CLI's karma builder is deprecated and goes away
 * on the road to 22, taking `ng test` with it, so the runner had to move before
 * the version march rather than during it — a suite that cannot run is a suite
 * that cannot tell you whether a hop broke something.
 *
 * The move is cheap because of what these specs are: seven files that construct
 * classes directly with stub collaborators. Not one uses `TestBed`, so nothing
 * here compiles a component, resolves a `templateUrl`, or needs Angular's JIT
 * compiler or a browser. `harness/` already runs on Vitest, so this is also one
 * runner for the repo instead of two.
 *
 * What this deliberately does not do is provide a route for `TestBed` specs. If
 * one is ever wanted, that needs an Angular-aware Vite plugin to inline component
 * resources, which is a real dependency and a decision worth making on purpose
 * rather than inheriting from a config comment.
 */
export default defineConfig({
  test: {
    // Jasmine's `describe`/`it`/`expect` were globals under Karma, and keeping
    // them global is what makes this a runner change rather than a rewrite of
    // seven files.
    globals: true,
    // Three specs touch `document`, `window` or `customElements`.
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    setupFiles: ['src/test-setup.ts'],
    // `harness/` has its own project and its own config; running both from here
    // would give two different meanings to `npm test` in the same repo.
    root: '.',
    server: {
      deps: {
        /**
         * Let Vite resolve these packages instead of Node.
         *
         * Each ships an fesm bundle that imports `rxjs/operators` as a bare
         * directory. rxjs 6 publishes no `exports` map, so Node's ESM loader
         * refuses the import outright (`ERR_UNSUPPORTED_DIR_IMPORT`) and the
         * spec that reaches it fails to load. Vite's resolver applies
         * node-resolution semantics and finds the index file.
         *
         * Inlining is the mechanism rather than a `resolve.alias` on
         * `rxjs/operators`, which looks like the tidier fix and does nothing: an
         * externalized package is resolved by Node before Vite sees it, so no
         * alias applies. Inlining is what puts the import through Vite at all.
         *
         * The list is every dependency in the tree with this packaging, found by
         * grep rather than one test failure at a time. rxjs 7 publishes proper
         * entry points and makes the whole block unnecessary, which happens
         * anyway at Angular 16.
         */
        inline: [/@angular\//, /@ngx-translate\//, /@ng-select\//, /ngx-mat-select-search/],
      },
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/main.ts', 'src/polyfills.ts', 'src/test.ts', 'src/environments/**'],
    },
  },
  resolve: {
    alias: {
      /**
       * `import packageJson from 'package.json'` appears in two source files and
       * resolves through tsconfig's `baseUrl: './'`, which the Angular CLI honors
       * and Vite does not. Mapped explicitly rather than by teaching Vite the
       * whole tsconfig, since this is the only such import in the codebase.
       */
      'package.json': fileURLToPath(new URL('./package.json', import.meta.url)),
    },
  },
  /**
   * Stated inline rather than discovered.
   *
   * The root tsconfig.json is a solution-style file with no `compilerOptions`, so
   * nothing useful would be found there. Both settings are load-bearing: Angular
   * uses TypeScript's legacy decorators, and class fields must be assigned rather
   * than defined, or they are installed with `Object.defineProperty` and shadow
   * the accessors decorators put in place. The Angular compiler forces the same
   * pair for the same reason.
   *
   * Written as `oxc` rather than `esbuild` because Vite 8 transforms with oxc and
   * ignores the esbuild block entirely — it says so on startup, then fails every
   * spec that imports a decorated class with "Invalid or unexpected token". The
   * three settings do not map one for one. `experimentalDecorators` is
   * `decorator.legacy`, and `useDefineForClassFields: false` is the *pair*
   * `assumptions.setPublicClassFields` and
   * `typescript.removeClassFieldsWithoutInitializer`, both true; oxc documents
   * that combination as the equivalent, and either alone is not.
   */
  oxc: {
    target: 'es2022',
    decorator: { legacy: true },
    assumptions: { setPublicClassFields: true },
    typescript: { removeClassFieldsWithoutInitializer: true },
  },
});
