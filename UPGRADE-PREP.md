# Decoupling Done Ahead of the Angular 14 → 22 Upgrade

Six commits on `decouple-for-ng-upgrade`, all on top of `cee-with-model-library`.
The goal was not to start the upgrade: it was to make the upgrade's safety net
survive it, and to take the independent dependency jumps out of the version march
so a failure there means one thing instead of two.

Every commit was verified against the full gate. Nothing was re-baselined.

## What Landed

**Packaging no longer assumes webpack.** The visual suite built its bundle with
`cat runtime.js polyfills.js main.js`. Those filenames and the concatenation
itself belong to the webpack `browser` builder; the esbuild `application` builder
emits a `browser/` subdirectory, hashed filenames, and an entry that imports
sibling chunks, which concatenation turns into a file with dangling `import`
statements — broken while still looking like a bundle. Packaging now goes through
`visual/resolve-build-output.mjs`, which picks both the files and the operation,
deciding by reading the entry rather than by consulting a version number.
`visual/packaging.test.mjs` covers both builder shapes against a synthetic `dist`,
including that the flattened esbuild artifact evaluates.

The freshness guard gained a manifest recording strategy, inputs and a sha256.
Timestamps alone stop being enough once the builder can change underneath the
harness: a stale copy made from the old output shape is easily *newer* than the
new output, which is the same false green that guard already existed to prevent.

**Brand values are behind an adapter.** `styles-own.scss` expressed CEE's
appearance in Material's theming vocabulary — `define-palette`,
`define-light-theme`, `define-typography-config`, `get-color-from-palette`,
`$red-palette` — all of which move. v18 renamed the M2 helpers to `m2-*`, and M3
replaces the model rather than renaming it again. Now `_cee-tokens.scss` holds
CEDAR's values and may not reference Material, and `_cee-material-theme.scss` is
the only file that touches Material's API and carries the list of renames ahead.

The adapter exposes mixins and emits nothing at the top level on purpose: `@use`
would hoist Material's CSS above the rules that override it and silently reorder
the cascade. Compiled output came out at 3498 lines with two lines different, both
intended — a dead palette-generator comment that was being shipped as CSS, and
`--cee-color-text-primary` reading `#ffffff` rather than `white`, the same color
spelled as the contrast map spells it.

**The visual contract is written down.** `THEMING.md` records what CEE's
appearance is committed to, what is incidental, the 16 `.mat-*` selectors across
10 files that reach into Material's internals, and a five-step order for judging a
failing snapshot. The Material 15 hop will turn the baselines red for legitimate
reasons; this exists so that moment is a decision rather than an improvisation at
2am.

**ngx-translate is at its Angular 14 ceiling.** core 11 → 14 and http-loader
4 → 7, three majors each, landed alone against a green suite instead of inside the
march. The API held across the jump.

**Unit tests run on Vitest.** The karma builder is deprecated and goes away before
22. Seven spec files, 51 tests, none using `TestBed`, now run in Node in about a
second instead of launching Chrome — and the repo has one test runner instead of
two.

**Dead weight removed.** The protractor `e2e/` scaffolding was untouched since the
initial commit, asserted Angular's default welcome text, and had no protractor
installed. `@types/node` went from ^12 (EOL 2022) to ^20.

## Coverage That Did Not Exist Before

Two gaps turned up while working, both in the shape that matters most: a thing
that fails without looking like it failed.

`FallbackTranslateLoader` fetches an external language map and falls back to the
bundled one. Only the fallback was covered, and by accident — the multi-editor
route points at a prefix that is not there, so every run 404s. The fetch itself
was exercised only by failing. A translation loader that silently stops fetching
does not look broken: it looks like the built-in text, which is also what CEE
shows when everything is fine. Two tests now assert both directions against the
same string.

Under Vitest, an unlinked Angular partial declaration makes a spec file fail to
*import*, so its tests are never registered and the run reports fewer passing
tests rather than a failure. Seven of the 51 vanished that way before
`src/test-setup.ts` existed. Worth knowing during the march, when spec files will
be failing to import for other reasons.

## The State of the Gate

| Suite | Before | After |
| --- | --- | --- |
| Unit | 51 (Karma, headless Chrome) | 51 (Vitest, Node) |
| Domain | 2270 | 2270 |
| Visual | 325 | 329 |
| Packaging | none | 9 |
| Bundle gzip-9 | 749,628 | 749,582 |

Verified from a clean `npm ci` against both lockfiles.

## What Was Deliberately Not Done

**Nothing was upgraded toward 22.** No Angular package moved. That is the next
piece of work, not this one.

**The stock-teal question is left open.** The theme applied to components uses
Angular's stock teal and deep-orange palettes, not CEDAR's brand palettes. Stock
teal 600 accounts for 35 color values in the shipped bundle; CEDAR's `#0f7686`
appears twice, both outside the Material theme. The brand palettes are fully
specified and drive nothing but three custom properties. This looks like an
accident, but correcting it changes what users see, so it stays exactly as-is.
`THEMING.md` sets out the trade-off. Deciding it during the upgrade is the one
option with nothing to recommend it.

**Material's own palettes were not inlined into the tokens.** It was considered
and rejected: the M2 palettes are frozen historical constants, so pinning their
values buys almost nothing, while transcribing them (including the `rgba`-based
contrast entries) risks a silent mismatch. The single choke point is what makes
the rename a one-line change.

**`ng lint` was left broken.** It has never worked in this repo:
`angular.json` declares an `@angular-eslint` builder that has never been a
dependency. Adopting a linter means triaging a backlog of first-run findings,
which is a separate decision. A working lint gate would help the march surface
deprecated API usage, so it is worth doing — just not silently, inside this.

**No `TestBed` route under Vitest.** Nothing under `src/**` needs one today.
Adding one requires an Angular-aware Vite plugin, which is a real dependency and
should be a deliberate choice rather than something inherited from a config
comment.

## What This Changes About the Upgrade

The pre-existing estimate was roughly 65% to reach a compiling, unit-green branch
and 10–15% to reach one whose visual and bundle gates were honestly satisfied. The
first number is unchanged; nothing here makes Angular's breaking changes easier.

The second was low because the safety net was coupled to the builder being
replaced, the baselines had no standing definition of a regression, and two
dependency jumps were tangled into the same diff as the Angular hops. Those are
the three things that changed. The remaining risk is concentrated where it belongs
— the Material 15 MDC restyle and the form-field overrides that force padding
against a DOM MDC replaces — and that risk is now legible rather than diffuse.

The version march still wants a human at the Material 15 hop. What it no longer
wants is a human to reconstruct, at that moment, what CEE was supposed to look
like.
