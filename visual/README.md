# CEE Visual Baseline

Playwright screenshot regression for the **built web component**.

> **Status: 16 tests, all passing**, verified stable across three consecutive
> runs (~5s each) on Chromium / macOS arm64.

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

Five templates, each exercising a distinct layout mechanism, generated
deterministically by `generate-fixtures.mjs` from the CEDAR Model TypeScript
Library:

| Fixture | Exercises |
|---|---|
| `01-input-types` | text, textarea, numeric, email, phone, link, datetime |
| `02-choices` | radio, checkbox, single- and multi-select lists |
| `03-nested-multi` | multi-instance elements nested two deep, chip pagers |
| `04-controlled-terms` | controlled-term autocomplete, ORCID, ROR |
| `05-static-paged` | section break, rich text, page breaks |

Hand-picked rather than exhaustive. Screenshot diffs are for catching rendering
regressions, and five templates covering distinct layout mechanisms catch that
as well as five hundred — while staying reviewable when a diff actually fires.

Two viewports: `desktop` (1280×900) and `narrow` (480×900).

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

Screenshot suites are only useful if red means something. Three things keep this
one stable:

1. **`document.fonts.ready`.** The bundle embeds Roboto at three weights plus
   Material Icons. They load asynchronously and re-measure every text run when
   they land — shifting layout *after* the DOM stops mutating. Without waiting,
   the suite is intermittently off by a few pixels. This was observed, not
   theorised: before the fix, runs took 34s–1.3m with sporadic failures; after,
   5.4s and clean.
2. **A DOM-settled poll, then a re-settle after fonts.** The host page sets
   `window.__ceeReady` only once both have quiesced; tests wait on that flag
   rather than a fixed timeout.
3. **No network.** `terminologyIntegratedSearchUrl` points at an unreachable
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
