# Roadmap

Where CEE is, what's blocking it, and the order things need to happen in.
Scoped to the framework-upgrade programme and the test coverage it depends on.

Last reviewed against `develop` @ CEE 1.5.2.

---

## Where we are

CEE is on **Angular 14**, which left long-term support in late 2023. The
application code is healthy; the framework and three of its dependencies are
not. Nothing here is urgent in the sense of broken today — it is urgent in the
sense that the cost of the jump grows every release.

| | |
|---|---|
| Angular | 14.3 (EOL) |
| TypeScript | 4.8 |
| rxjs | 6.6.7 |
| Test coverage before this work | 40 spec files, 45 `it()` blocks, all `expect(component).toBeTruthy()` |
| Test coverage now | + 422 domain tests in `harness/` |

## The blocker, stated plainly

`@angular-material-components/datetime-picker` **caps the upgrade at Angular
16**. Its latest release is 16.0.1; Angular is at 22. Upgrading to 16 and
stopping is not a resting place — 16 is itself EOL, so that path buys a second
migration later.

The blast radius is small: three module imports in
`src/app/modules/input-types/input-types.module.ts` and exactly one element,
`<ngx-mat-timepicker>`, in
`src/app/modules/input-types/components/cedar-input-datetime/cedar-input-datetime.component.html`.

`@ng-matero/extensions` (v22, actively tracks Angular, ships `mtx-datetimepicker`)
is the successor. **Deciding this is the first task**, because it determines
whether the plan is a two-hop migration or an eight-hop one.

### Dependency audit

| Package | Current | Latest | Peers | Verdict |
|---|---|---|---|---|
| `@angular-material-components/datetime-picker` | 8.0.0 | 16.0.1 | Angular 16 only | **Blocker — replace** |
| `@ngx-translate/core` | 11.0.0 | 18.0.0 | Angular ≥18, rxjs ≥7 | API rewrite across 8 majors; 8 files touch it |
| `@ng-select/ng-select` | 9.1.0 | 23.5.1 | Angular 22 | Fine |
| `ngx-mat-select-search` | 4.2.1 | 9.0.0 | Material 17–22 | Fine |

---

## Phases

### Phase 0 — Domain test harness ✅ done

`harness/` — 422 headless tests over template parsing, instance construction,
path resolution, value writes, multi-instance mechanics, controlled-term
constraints and the quality report. Imports no Angular, so it survives the
upgrade unchanged. See [harness/README.md](harness/README.md).

Deliberately **not** upgrade insurance: the pure-TypeScript domain layer is the
part least likely to break when the framework moves. This phase buys refactoring
confidence and a characterization baseline.

### Phase 1 — Visual regression baseline ✅ done

`visual/` — 16 Playwright screenshot tests against the **concatenated bundle**
as an embedder consumes it, not the dev server. Five fixtures covering input
types, choice widgets, two-deep multi-instance nesting, controlled terms, and
static content with page breaks; two viewports. Stable across repeated runs
(~5s). See [visual/README.md](visual/README.md).

Baselines were captured on Angular 14 **before** any upgrade work, which is the
only moment they are worth capturing.

### Phase 2 — Dependency de-risking ⬅ next

1. Replace the datetime picker with `@ng-matero/extensions` (contained: one
   element, one component, three module imports)
2. Plan the ngx-translate v11 → v18 rewrite — `forRoot`/loader wiring changed
   shape; `FallbackTranslateLoader` and its factory will need rework

### Phase 3 — Angular upgrade, one major at a time

`ng update` migration schematics chain, so skipping hops means hand-applying
migrations.

| Hop | The work |
|---|---|
| 14 → 15 | **The hard one.** Material MDC migration; run `ng generate @angular/material:mdc-migration`. Expect broad SCSS churn. |
| 15 → 16 | `entryComponents` removed (used in `app.module.prod.ts`), rxjs 6 → 7, TypeScript 5.0 |
| 16 → 17 | New esbuild/vite build pipeline — the web-component concat step in the README changes shape |
| 17 → 22 | Comparatively smooth |

Note `origin/upgrade/angular-15` exists but is a dead stub: 3 commits, last
touched November 2023, branched from an old `main`. Its "Legacy references
removed" commit may be worth skimming for an MDC hit list; it is not a
foundation.

### Phase 4 — Retire the legacy test scaffolding

Delete the 40 `should create` specs and the Protractor e2e setup (Protractor was
deprecated in 2021). They cost maintenance and assert nothing. Do this *after*
Phases 1–3, so nothing is removed while it might still be a signal.

---

## Open findings

### Defects, characterized not fixed

Both are pinned in `harness/test/cardinality.spec.ts` under "known defects
(characterized, not endorsed)". The tests assert current behaviour, so fixing
either is a deliberate, visible change.

1. **A filled required ORCID/ROR field never satisfies its requirement.**
   `extractPlainValue` recognises a bare `@id` only for `InputType.link`; every
   other IRI-valued type falls through to the controlled-term branch and reads
   an undefined `rdfs:label`. Affects **seven** input types on `develop`
   (`ext-orcid`, `ext-ror`, `ext-pfas`, `ext-pubmed`, `ext-rrid`,
   `ext-nih-grant-id`, `ext-doi`). Fix: test set membership instead of equality
   with `link` — `data-quality-report-builder.handler.ts:155`.

2. **Filling one page of a multi element marks every page satisfied.**
   `buildRecursively` evaluates a multi element's children once against the
   current page, incrementing the required-value counters, then `cloneDeep`s the
   result `currentCount` times. An incomplete instance reports as valid —
   `data-quality-report-builder.handler.ts:65-80`.

### Coverage gap

CEE `develop` declares 24 input types; the CEDAR Model TypeScript Library's
`CedarBuilders` facade exposes builders for 19. Uncovered: `ext-pfas`,
`ext-pubmed`, `ext-rrid`, `ext-nih-grant-id`, `ext-doi`. `ext-pfas` is closest —
builder files exist under `model/cedar/field/dynamic/ext-pfas/` but are not
exported. All five are shaped like `ExtOrcid`/`ExtRor`; closing the gap is
mechanical work in the model library, not here.

`harness/test/coverage.spec.ts` fails if a sixth type appears unacknowledged.

### Design debt worth paying independently

- **Circular import.** `data-object-util.ts:157` reads one static (`iriPrefix`)
  off the top-level Angular component, dragging the whole component subtree —
  HttpClient services, a `package.json` import, and an edge back into
  `DataObjectUtil` — into anything using the data-object builder. It survives
  only because webpack tolerates it. Moving `iriPrefix` to a constant would
  delete both this and `harness/stubs/editor-component.ts`.
- **Two instance trees, no single source of truth.** Every mutation is written
  separately to `instanceExtractData` and `instanceFullData`;
  `multiInstanceItemAdd` even needs a `deleteContext` between the two passes.
  Divergence is invisible from the UI, because widgets read one tree and the
  host page reads the other. The harness now asserts they agree.
- **Path resolution is not pure.** `getDataObjectNodeByPath` resolves through
  each multi ancestor's `currentIndex`, so it returns different nodes depending
  on which pages the user has flipped to. `HandlerContext` depends on mutating
  data *before* the cursor; nothing in the code says so.

---

## Out of scope

- Rewriting CEE in a different framework. The domain layer is sound and
  framework-independent; the cost is in the widget layer either way.
- Fixing the two characterized defects as part of the upgrade. They are product
  decisions about validity semantics, not migration blockers — decide them
  separately.
- Adding the five missing field-type builders. That belongs in
  `cedar-model-typescript-library`.
