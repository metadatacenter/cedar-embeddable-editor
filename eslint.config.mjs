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
  /*
   * Baseline for @typescript-eslint/no-explicit-any, which stays an error everywhere
   * else so that new code cannot add to the debt. Each entry below is an `any` that
   * predates the lint gate; removing one means giving it a real type and deleting its
   * line here. 25 files and 41 warnings, down from 44 and 77.
   *
   * 41 and not 32, which is what this said before the toolchain upgrade. The last three
   * files below carried a blanket `/* eslint-disable @typescript-eslint/no-explicit-any *\/`
   * at the top, so their nine `any`s were suppressed rather than counted — while this
   * very comment claimed the debt was "a curated baseline rather than a blanket
   * suppression". It was not, in three files. They are listed here now, which makes the
   * claim true and the number honest. A warning that shows up in every run is pressure;
   * a file-level disable is silence.
   *
   * The clusters:
   *
   *   - `setCurrentValue(currentValue: any)`, from the abstract member in
   *     cedar-ui-component.model.ts. Typing it needs a union for every CEDAR field value.
   *   - `callbackOwnerObject` / `sampleTemplateLoaderObject` host callbacks, which a host
   *     supplies and CEE only calls back into.
   *   - Angular and ngx-translate interfaces that declare `any` themselves:
   *     ControlValueAccessor's `registerOnChange`, TranslateLoader's `Observable<any>`.
   *   - `x as any` at the model-library boundary, where CEE hands a plain object to a
   *     reader whose parameter is a library type it does not construct.
   */
  {
    files: [
      'src/app/modules/input-types/components/cedar-foo-bar/cedar-foo-bar.component.ts',
      'src/app/modules/input-types/components/cedar-input-controlled/cedar-input-controlled.component.ts',
      'src/app/modules/input-types/components/cedar-input-datetime/cedar-input-datetime.component.ts',
      'src/app/modules/input-types/components/cedar-input-ror/cedar-input-ror.component.ts',
      'src/app/modules/input-types/components/cedar-input-ror/ror-details/ror-details.component.ts',
      'src/app/modules/input-types/components/cedar-input-select/cedar-input-select.component.ts',
      'src/app/modules/input-types/components/cedar-static-image/cedar-static-image.component.ts',
      'src/app/modules/input-types/components/cedar-static-rich-text/cedar-static-rich-text.component.ts',
      'src/app/modules/input-types/components/cedar-static-section-break/cedar-static-section-break.component.ts',
      'src/app/modules/input-types/components/cedar-static-youtube/cedar-static-youtube.component.ts',
      'src/app/modules/shared/components/cedar-embeddable-metadata-editor-wrapper/cedar-embeddable-metadata-editor-wrapper.component.spec.ts',
      'src/app/modules/shared/components/cedar-embeddable-metadata-editor/cedar-embeddable-metadata-editor.component.spec.ts',
      'src/app/modules/shared/components/cedar-embeddable-metadata-editor/cedar-embeddable-metadata-editor.component.ts',
      'src/app/modules/shared/components/cedar-multi-pager/cedar-multi-pager.component.ts',
      'src/app/modules/shared/components/sample-template-select/sample-template-select.component.ts',
      'src/app/modules/shared/components/sample-templates/sample-templates.component.ts',
      'src/app/modules/shared/components/static-header/static-header.component.ts',
      'src/app/modules/shared/components/timezone-picker/timezone-picker.component.ts',
      'src/app/modules/shared/factory/yaml-template-parser.ts',
      'src/app/modules/shared/util/fallback-translate-loader-factory.ts',
      'src/app/modules/shared/util/fallback-translate-loader.ts',
      'src/main.ts',
      'src/app/modules/shared/util/instance-deserializer.ts',
      'src/app/modules/shared/util/instance-serializer.ts',
      'src/app/modules/shared/util/instance-value-node.ts',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended],
    rules: {
      /*
       * 203 sites, and the fourth of the "adopt the newer idiom" rules. It wants
       * `@if`/`@for` in place of `*ngIf`/`*ngFor`.
       *
       * `ng update` offered exactly this migration at Angular 21 and it was declined
       * there on the roadmap's own advice — do not combine a framework hop with a
       * control-flow rewrite — after seeing it touch 33 files in one diff. `NgIf` and
       * `NgFor` are not deprecated and work through 22. Turning the rule on now would
       * assert the opposite of a decision already taken, and reverse it by nagging.
       */
      '@angular-eslint/template/prefer-control-flow': 'off',
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
