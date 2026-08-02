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

The **usage** is small: three module imports in
`src/app/modules/input-types/input-types.module.ts` and exactly one element,
`<ngx-mat-timepicker>`, in
`src/app/modules/input-types/components/cedar-input-datetime/cedar-input-datetime.component.html`.

The **replacement** is not. See Phase 2 — `@ng-matero/extensions`, the obvious
candidate, cannot express what CEE needs.

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

### Phase 2 — Dependency de-risking ⬅ next, blocked on a decision

#### The time picker: `@ng-matero/extensions` is not a drop-in

An earlier draft of this roadmap called the swap "contained". That was wrong —
it confused *usage count* with *replacement effort*. Investigated against
`@ng-matero/extensions@14.8.5` (which does exist for Angular 14, tagged
`v14-lts`, peering `>=14.0.0`):

| | `ngx-mat-timepicker` (current) | `@ng-matero/extensions` |
|---|---|---|
| Form factor | inline, always-visible spinners | popup attached to an input, plus a toggle |
| Time UI | hh:mm:ss spinner column | clock face |
| 12/24 hour | `enableMeridian` | `twelvehour` ✅ |
| Hour-only precision | `disableMinute` | no equivalent |
| **Seconds** | `showSeconds` | **not supported at all** |

The seconds gap is disqualifying, not cosmetic. Grepping the whole
`mtxDatetimepicker` bundle and its `.d.ts` files for `second` returns only
`secondary` (colour and overlay positioning). CEDAR's temporal granularity runs
`year → month → day → hour → minute → second → decimalSecond`, and CEE supports
the bottom two today —
`cedar-input-datetime.component.ts:114` (`showSeconds`) and `:118`
(`showDecimalSeconds`). Adopting mtx would be a **functional regression against
the CEDAR model**, not a UX change.

Note also that CEE does not use a *datetime* picker at all. The date half is
CEE's own `app-date-picker`; only the time half comes from the dependency.

#### Options

**A. Ride `ngx-mat-timepicker` to Angular 16, then swap.** It supports 14, 15
and 16, so it does not block the first two hops. Defers the problem — and
defers it into the middle of a migration, which is the worst time to be making
a UI decision.

**B. Build an in-house `app-time-picker`. ← recommended.** CEE already owns
`app-date-picker` and `app-timezone-picker`; a time picker would follow the same
pattern and sit beside them. It is the only option that both removes the
dependency permanently and expresses CEDAR's granularity model exactly, because
we would be writing it against that model rather than adapting to someone
else's. Scope is bounded: hour/minute/second number inputs plus a meridian
toggle, driven by the four predicates already in
`cedar-input-datetime.component.ts`. The parsing and storage representation
(`datetimeParsed`) already exist and do not change. Both test suites are now in
place to verify it — `harness/` for the value semantics, `visual/` for the
rendering.

**C. Adopt mtx and accept the regression.** Loses second and decimal-second
precision. Only viable if no CEDAR template in practice uses those
granularities — which should be measured, not assumed, before anyone considers
it.

**This decision gates Phase 3.** Option B is the recommendation; it needs a
sign-off because it is new UI code rather than a dependency bump.

#### Also in this phase

Plan the ngx-translate v11 → v18 rewrite. `forRoot`/loader wiring changed shape
across eight majors; `FallbackTranslateLoader` and its factory will need rework.
Eight files import from `@ngx-translate/*`.

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
