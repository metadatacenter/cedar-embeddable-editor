// @ts-check
/**
 * ESLint flat config, replacing `.eslintrc.json`.
 *
 * Not a stylistic preference: `angular-eslint` 22 — the version that matches the
 * Angular CEE actually runs — requires ESLint 9 or 10, and ESLint 9 makes flat
 * config the default while 10 removes the old format entirely. The eslintrc file
 * this replaces was pinned at `@angular-eslint` 14, eight majors behind the
 * framework it was linting.
 *
 * `.mjs` rather than `.js` because package.json declares no `type`, so a bare
 * `.js` here would be parsed as CommonJS and these imports would fail.
 *
 * The four `@angular-eslint/*` packages are now one `angular-eslint`, and the two
 * `@typescript-eslint/*` are one `typescript-eslint`. That is the upstream shape,
 * not a repackaging done here.
 */
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
import prettierRecommended from 'eslint-plugin-prettier/recommended';

export default tseslint.config(
  {
    ignores: ['dist/**', 'dist-npm/**', 'out-tsc/**', 'node_modules/**'],
  },
  {
    // `**/*.ts`, not `*.ts`. Under eslintrc a bare `*.ts` matched at any depth;
    // flat config globs are literal, so the old pattern would have linted only
    // the repository root and reported a clean run over almost nothing.
    files: ['**/*.ts'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      ...angular.configs.tsRecommended,
      prettierRecommended,
    ],
    processor: angular.processInlineTemplates,
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      /*
       * `@typescript-eslint/object-curly-spacing` used to sit here. typescript-eslint
       * 8 removed its formatting rules — they moved to `@stylistic` — and Prettier
       * already enforces the same spacing, with `eslint-config-prettier` switching
       * off anything that would argue with it. Dropped rather than re-added from
       * another plugin, because a second opinion on formatting is how the two end up
       * disagreeing.
       */
      'prettier/prettier': 'error',
      // A leading underscore marks a binding that an interface, override or callback
      // signature forces us to declare but that the body does not use.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      /*
       * Three rules asking CEE to adopt a newer Angular idiom, switched off because
       * each names an architectural change that is a decision elsewhere, not lint debt.
       * Between them they accounted for 208 of the 413 errors this upgrade first
       * reported, and the template rule below for another 203 — 411 of 413, which is
       * the shape of the finding rather than a reason to suppress it. A rule that fires
       * 118 times is describing a rewrite, not a defect.
       *
       * Leaving them on would make `test:ci` red until someone does the rewrite, and a
       * gate nobody can pass gets ignored rather than fixed. They are recorded on the
       * CEE roadmap instead, where the decision belongs.
       */
      // 118 sites. Constructor injection still works in 22; `inject()` is the newer
      // spelling of the same thing.
      '@angular-eslint/prefer-inject': 'off',
      // 47 sites. The roadmap puts rewriting CEE around standalone components out of
      // scope explicitly, and every component here declares `standalone: false`.
      '@angular-eslint/prefer-standalone': 'off',

      /*
       * This one is not deferred — it is wrong for CEE, and would break it.
       *
       * 43 sites. CEE drives rendering from `DoCheck` and mutates its model objects in
       * place; under OnPush those mutations produce no view update. Angular 22 made
       * OnPush the default for a component that names no strategy, which is exactly why
       * `ng update` stamped `ChangeDetectionStrategy.Eager` onto all 46 components. Following
       * this rule would undo that migration by hand.
       *
       * Moving CEE to OnPush means moving it to immutable model updates or signals
       * first. Until then the rule is advice for a different codebase.
       */
      '@angular-eslint/prefer-on-push-component-change-detection': 'off',
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended],
    rules: {
      /*
       * On, because the migration it asks for is done: 203 sites across 33
       * templates, 184 `*ngIf` and 19 `*ngFor`, rewritten as `@if` and `@for` by
       * `ng generate @angular/core:control-flow`.
       *
       * It was declined once, at Angular 21, on the advice not to combine a
       * framework hop with a control-flow rewrite. That advice expired when the
       * march landed, and the reason given alongside it — that `NgIf` and `NgFor`
       * are not deprecated — was wrong even then: Angular marked them
       * `@deprecated 20.0`, with removal intended in a later major.
       *
       * The rule is what stops the old syntax coming back one template at a time.
       */
      '@angular-eslint/template/prefer-control-flow': 'error',
    },
  },
  {
    files: ['**/*.js', '**/*.cjs'],
    extends: [js.configs.recommended, prettierRecommended],
    languageOptions: {
      globals: { ...globals.node },
      sourceType: 'script',
    },
  },
);
