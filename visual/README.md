# CEE Visual Baseline

Playwright screenshot regression for the **built web component**.

> **Status: 360 tests:** 330 full Chromium checks across two viewports, plus
> ten semantic smoke checks on each of Chromium, Firefox and WebKit. A run reports
> 356 of them — four are `fixme`, held open on purpose because no fixture reaches
> the two config flags they cover.

## Why this exists, and why it is separate from `harness/`

[`harness/`](../harness/README.md) imports no Angular — deliberately, so it
survives the framework upgrade untouched. The direct consequence is that it
cannot see a single thing about how CEE *looks*.

That gap is exactly where the upgrade risk lives. Material 15 rewrote every
component's DOM structure and CSS class names; CEE has 42 SCSS files and uses
`ViewEncapsulation.None`, which is load-bearing — it is how the web component
styles itself. No amount of domain testing catches a Material migration
silently changing the form's layout.

**Capture these baselines before the 14 → 15 hop.** Afterwards they are only a
record of whatever the migration already did.

## What it tests against

The single packaged bundle, exactly as an embedder consumes it, served
statically. Not `ng serve`. An upgrade that breaks the bundle while leaving the
dev server working is precisely the failure this is here to catch.

`npm run bundle` produces that file, and `resolve-build-output.mjs` is the only
place that knows how. Under the webpack `browser` builder the packaging step is a
concatenation of `runtime.js`, `polyfills.js` and `main.js` in load order, which
is the artifact README.md tells embedders to build. Under Angular's esbuild
`application` builder the output moves to a `browser/` subdirectory, filenames
gain hashes, and the entry imports sibling chunks — so it is flattened with
esbuild into one classic script instead, because concatenating an ES module graph
would leave dangling `import` statements in a file that no longer loads.

The step chooses between the two by reading the entry, not by consulting a
version number. `packaging.test.mjs` covers both shapes against a synthetic
`dist`, including that the flattened result actually evaluates.

## Fixtures

Twelve templates, each exercising a distinct layout mechanism, generated
deterministically by `generate-fixtures.mjs` from the CEDAR Model TypeScript
Library:

| Fixture | Exercises |
|---|---|
| `01-input-types` | text, textarea, numeric, email, phone, link, datetime |
| `02-choices` | radio, checkbox, single- and multi-select lists |
| `03-nested-multi` | multi-instance elements nested two deep, chip pagers |
| `04-controlled-terms` | controlled-term autocomplete, ORCID, ROR |
| `05-static-paged` | section break, rich text, page breaks |
| `06-validation` | `mat-error` and the form-field subscript, in five error states |
| `07-timezone` | the timezone picker — CEE's only `ng-select` |
| `08-authority` | all seven external-authority widgets |
| `09-temporal` | all eight temporal granularities and both time formats |
| `10-attribute-values` | attribute-value names and values |
| `12-render-decision` | the three multi-field rendering cases |
| `13-paged-choice` | a choice field inside a multi-instance element |

Hand-picked rather than exhaustive. Screenshot diffs are for catching rendering
regressions, and a handful of templates covering distinct layout mechanisms
catch that as well as five hundred — while staying reviewable when a diff
actually fires. Breadth of *states* is worth more here than breadth of
fixtures; see below.

Two viewports: `desktop` (1280×900) and `narrow` (480×900).

## Cross-browser smoke coverage

The pixel baselines remain Chromium/macOS-only. Repeating screenshots for each
engine would mostly version font rasterisation and triple the review burden.
Instead, `cross-browser-smoke.spec.ts` runs seven semantic checks in Chromium,
Firefox and WebKit against the same production bundle:

- custom-element registration and Shadow DOM rendering;
- edits reaching a composed `change` event and `currentMetadata`;
- Angular Material overlays remaining inside the custom element;
- the custom time picker updating temporal data;
- multi-instance add and delete operations;
- read-only rendering; and
- instance replacement with JSON and YAML output.

Every smoke check also fails on an unexpected page or console error. The
`desktop` and `narrow` projects exclude this spec; dedicated `*-smoke` projects
run it once per browser engine.

## Beyond the default state

The fixture screenshots capture an empty form in the base configuration. An
audit of the baselines against CEE's templates found **13 Material element
types rendering in no screenshot at all** — led by `mat-error` (30 template
occurrences) and `mat-option` (26). Both exist only in states a default-state
screenshot never reaches: a touched control, and an open overlay.

That gap sat squarely on the migration risk. MDC restructured the
`mat-form-field` subscript wrapper — where errors and hints live — and changed
overlay positioning.

Now covered:

| State | How it is reached |
|---|---|
| Validation errors | focus + blur each required field; Material's default ErrorStateMatcher shows `mat-error` only once a control is touched |
| Invalid email, min-length | fill an invalid value, then blur |
| Open select panel | click `mat-select` — renders `mat-option` in the CDK overlay |
| Filled fields | type into text, textarea, numeric, email and link |
| Chrome on | `?c=chrome` — header, footer, preferences menu, and with them `mat-toolbar` and `mat-slide-toggle` |
| Read-only mode | `?c=readonly`, over two fixtures |

Not covered, deliberately: the lookup spinners inside `mat-option`. They only
appear mid-request against a live terminology server, and the baseline must not
depend on the network.

## Running

Needs Node 24.19.0, which is what the app build uses too — one version for
everything, since Angular 15 ended the split that required two. See
[CEE-RUNBOOK.md](../../cedar-development/ops/CEE-RUNBOOK.md).

First time:

```bash
nvm use && npm install && npx playwright install chromium firefox webkit
```

The bundle and fixtures are build artifacts and are not committed. Rebuild the
app first if `../dist` is stale:

```bash
cd .. && npm run build:production
```

```bash
npm run prepare:all && npm test
```

To run only the compatibility checks:

```bash
npm test -- --project=chromium-smoke --project=firefox-smoke --project=webkit-smoke
```

## Bundle-size budget

`npm test` measures the exact artifact an embedder downloads: the packaged
`public/cedar-embeddable-editor.js`. It fails first if that copy is not
attributable to the current build — stale, hand-edited, or made by a different
builder than `dist` now holds — then enforces both raw and gzip-9 limits.

Attribution comes from `public/bundle-manifest.json`, written alongside the
bundle. It records the packaging strategy, the input filenames and a sha256 of
the result. The digest is what makes the size figure trustworthy without
re-deriving the bundle; the strategy and filenames are what catch a builder
switching underneath the harness, which timestamps alone would miss.

The baseline recorded on 2026-08-04 is 3,167,000 raw bytes and 749,628 gzip-9
bytes. The initial limits — 3,230,000 raw and 765,000 gzip-9 bytes — leave about
2% headroom. Run the check directly from the repository root with:

```bash
npm run test:bundle-size
```

Raising a limit is an intentional product decision. Update the baseline comment
in `check-bundle-size.mjs` to the newly measured size and explain the increase in
the pull request; do not add an environment-variable bypass.

To accept intentional visual changes:

```bash
npm run update
```

Review every changed PNG before committing. A baseline update is a claim that
the new rendering is correct.

## Determinism

Screenshot suites are only useful if red means something. Four things keep this
one stable:

1. **A pinned clock.** CEE seeds a temporal field's date and time from
   `new Date()` at init, so any fixture with one renders the current wall
   clock. `page.clock.setFixedTime` pins it. This was caught by reading a
   captured baseline and noticing the timepicker showed the real time — the
   stability runs had passed only because they completed within the same
   minute. A baseline that rots on a timer looks exactly like a real
   regression, which is the worst kind of false alarm.
2. **`document.fonts.ready`.** The bundle embeds Roboto at three weights plus
   Material Icons. They load asynchronously and re-measure every text run when
   they land — shifting layout *after* the DOM stops mutating. Without waiting,
   the suite is intermittently off by a few pixels. This was observed, not
   theorised: before the fix, runs took 34s–1.3m with sporadic failures; after,
   5.4s and clean.
3. **A DOM-settled poll, then a re-settle after fonts.** The host page sets
   `window.__ceeReady` only once both have quiesced; tests wait on that flag
   rather than a fixed timeout.
4. **No network.** `terminologyIntegratedSearchUrl` points at an unreachable
   port on purpose. The baseline must never depend on a live terminology
   server, and autocomplete panels are not screenshotted.

`maxDiffPixelRatio` is 0.01 — enough to absorb font rasterisation differences
between machines, far below what a Material DOM rewrite moves.

## A finding from building this

At 480px the multi-instance pager renders with `isAlignedUp`, which pulls its
chip row up into the expansion-panel header band — far enough that the chips
reach the header's horizontal centre. A user aiming for the middle of that
header to collapse the panel hits a page chip and switches instance instead.

The test clicks `mat-panel-title` at an explicit offset rather than the header
centre for this reason. Playwright found it by refusing to click: its
actionability check saw a `MAT-CHIP` at the target point.
