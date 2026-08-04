# CEE Visual Baseline

Playwright screenshot regression for the **built web component**.

> **Status: 294 tests, all passing** on Chromium / macOS, most recently in
> ~40s for both viewports.

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

The concatenated bundle — `runtime.js + polyfills.js + main.js` — exactly as an
embedder consumes it, served statically. Not `ng serve`. An upgrade that breaks
the bundle while leaving the dev server working is precisely the failure this is
here to catch.

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

Needs Node 20 — the app itself needs 18. See
[CEE-RUNBOOK.md](../../cedar-development/ops/CEE-RUNBOOK.md).

First time:

```bash
nvm use 20 && npm install && npx playwright install chromium
```

The bundle and fixtures are build artifacts and are not committed. Rebuild the
app first if `../dist` is stale:

```bash
cd .. && nvm use 18 && npx ng build --configuration=production
```

```bash
nvm use 20 && npm run prepare:all && npm test
```

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
