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
 * The move is cheap because of what these specs are: direct constructions of a
 * subject with stub collaborators. Not one uses `TestBed`, so nothing here
 * compiles a component, resolves a `templateUrl`, or needs Angular's JIT compiler
 * or a browser. `harness/` already runs on Vitest, so this is also one runner for
 * the repo instead of two.
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
    // every spec.
    globals: true,
    // Three specs touch `document`, `window` or `customElements`.
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    exclude: ['src/**/*.coordinator.spec.ts'],
    setupFiles: ['src/test-setup.ts'],
    // `harness/` has its own project and its own config; running both from here
    // would give two different meanings to `npm test` in the same repo.
    root: '.',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/main.ts', 'src/polyfills.ts', 'src/test.ts', 'src/environments/**'],
      thresholds: {
        // Host-input coordination is small, stateful and release-critical. Keep
        // regressions visible even when the broad component total barely moves.
        'src/app/modules/shared/util/artifact-input-coordinator.ts': {
          statements: 90,
          branches: 85,
          functions: 90,
          lines: 90,
        },
        'src/app/modules/shared/util/wrapper-config-coordinator.ts': {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
        'src/app/modules/shared/components/cedar-embeddable-metadata-editor-wrapper/*.ts': {
          statements: 70,
          branches: 60,
        },
        /*
         * The widgets that read values from users.
         *
         * A floor, not a target, and worth being honest about what it buys. It
         * does not catch a wrong test: `atLeastOneChecked` was covered by a spec
         * that handed it a shape no widget produces, and stayed green over a
         * required field that could never be satisfied. What it catches is the
         * case that produced most of what this floor was added after — a widget
         * with no spec at all. Three of these were at zero, including the radio
         * group, which is one of the two ways a template asks a closed question.
         */
        'src/app/modules/input-types/components/**/cedar-input-*.component.ts': {
          statements: 62,
          branches: 40,
          functions: 50,
          lines: 62,
        },
      },
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
