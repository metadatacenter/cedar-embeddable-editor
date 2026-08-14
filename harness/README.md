# CEE Test Harness

A headless, generative test harness for the CEDAR Embeddable Editor's domain
layer — template parsing, instance construction, path resolution, value writes,
multi-instance mechanics, and the data quality report.

> **Status: 2,202 tests, all passing** on Node 24.19.0 / Vitest 4.1.
> Verified non-vacuous by mutation testing — see [Does it have teeth?](#does-it-have-teeth).
> Three CEE defects found, all three fixed. See [What it found](#what-it-found).

## Why this exists

This was written while CEE was on Angular 14 and had to reach a supported version.
It is on 22 now, and the reasoning is kept in the present tense because it is the
argument for what this harness covers, not a status report — and because the next
framework march will meet the same shapes.

The instinct is "write tests first" — correct, but the obvious tests are the wrong
ones.

The gnarliest code in CEE (handlers, factory, `currentIndex`-dependent path
resolution, attribute-value handling) is the code **least** likely to break in
an Angular upgrade. It is plain TypeScript; `HandlerContext` is constructed with
`new`, not injected. Meanwhile the things that *will* break — Material 15's MDC
rewrite, `entryComponents`, rxjs 7, the ngx-translate API — are rendering and
wiring concerns.

So this harness is not upgrade insurance. It is the thing that lets you refactor
the domain layer with confidence, and it is written to survive the upgrade
untouched: **it does not import Angular at all.** Visual regression coverage
(Playwright against the built web component) is the separate piece that protects
the Material migration, and it needs to exist before the 14 → 15 hop.

## Approach

Generative **and** corpus-based, for different reasons.

A pile of real templates has unknown coverage; an enumeration of the decision
space has coverage you can point at. So most of this suite generates its own
templates. But generating them with the CEDAR Model TypeScript Library means CEE
is only ever fed input that library produced, and `test/corpus.spec.ts` closes
that: vendored snapshots of 37 fixtures from `cedar-test-artifacts` and 57
HuBMAP production templates from `cedar-artifact-library`, all authored by
people or by the CEDAR Template Editor. Their source commits and refresh
instructions are recorded in `fixtures/README.md`; no sibling artifact
repository is needed to run the suite. The loader enforces the recorded fixture
counts and required JSON/YAML pairs; a missing or incomplete snapshot fails test
collection instead of skipping the corpus suites.

The first run of that suite found CEE crashing on `template-003`. It also
matters prospectively — if CEE ever parses templates *with* the model library,
the generated suites will have that library on both sides of every comparison
and will agree with themselves regardless. The corpus snapshots are what would
catch a change in behaviour across that refactor.
[`src/axes.ts`](src/axes.ts) enumerates the axes
`TemplateRepresentationFactory.wrap()` actually branches on — input type,
cardinality, nesting position, required, hidden, static collapsing, page-break
shape — and [`src/generate.ts`](src/generate.ts) builds templates across their
cross-product using the **CEDAR Model TypeScript Library**.

The oracle is a round-trip, not a golden file:

```
generate template → CEE builds an instance → write a value
                  → read it back → it is what we wrote
                  → the model library parses the emitted JSON-LD
```

Properties don't rot. There are no snapshots to regenerate when unrelated things
change.

## Layout

| Path | Purpose |
|---|---|
| `src/axes.ts` | The branch-space enumeration, and the honest list of what isn't covered |
| `src/generate.ts` | Deterministic template generation via `CedarBuilders` |
| `src/controlled.ts` | Controlled-term constraint construction and subset enumeration |
| `src/driver.ts` | Headless CEE — reproduces the wrapper's startup path without Angular |
| `stubs/angular-core.ts` | No-op decorators, so the harness never loads Angular |
| `stubs/editor-component.ts` | Breaks the `DataObjectUtil` → editor-component circular import |
| `test/coverage.spec.ts` | Drift detection: does the generator still cover every `InputType`? |
| `test/roundtrip.spec.ts` | The oracle, swept across the cross-product |
| `test/controlled-terms.spec.ts` | All 15 constraint-kind subsets × cardinality × nesting × reload |
| `test/cardinality.spec.ts` | minItems, required values, two-level multi nesting |
| `test/value-constraints.spec.ts` | Text/numeric/temporal constraints, choice literals, defaults |
| `test/edge-cases.spec.ts` | Page breaks, static collapse, hidden fields, multi-instance, reload |
| `test/read-only.spec.ts` | Read-only mode |
| `test/corpus.spec.ts` | 37 corpus + 57 HuBMAP production templates, with tree snapshots |

## Dimensions covered

| Dimension | Extent |
|---|---|
| Input type | all 24 of CEE's input types |
| Cardinality | single / multi, `minItems` ∈ {0, 1, 2, 3, 5} |
| Nesting | root, in element, in multi element, multi-in-multi (two cursors) |
| Required | every non-static kind, single and inside multi elements |
| Controlled terms | all 15 non-empty subsets of {ontologies, classes, branches, valueSets}, plus multiplicity |
| Value constraints | min/maxLength, default, numberType × 5, min/maxValue, decimalPlaces, unitOfMeasure, temporalType × 3, granularity × 7, timezone |
| Choice literals | list (single + multiple), radio, checkbox; `selectedByDefault` and its instance pre-seeding |
| Instance lifecycle | build → write → save → reload, across the controlled-term matrix |
| Static content | image, youtube, richtext, section break, page break; collapsing on/off |
| Operating modes | edit vs read-only |

Constraint frequencies were taken from the HuBMAP corpus shipped with
`cedar-artifact-library` (`src/test/resources/templates-yaml/`) so the emphasis
matches real templates: `values` 601, `regex` 150, `minValue` 127, `default` 96,
`selected` 37, `granularity` 28.

## Running it

The harness depends on the built model library, resolved from
`@org.metadatacenter/cedar-model-typescript-library` on the BMIR Nexus, so no
local build of that library is needed.

```bash
cd /Users/martin/CEDAR/cedar-embeddable-editor/harness && npm install && npm test
```

Requires Node 24.19.0, the same version everything else in CEE uses — `nvm use` in
the repository root picks it up. There is no longer a version to switch between:
that was Angular 14's toolchain and the test tools disagreeing, and it ended at
Angular 15.

## Does it have teeth?

A suite that is green the day it is written is worth nothing until you have seen
it go red. Every fix below was mutation-tested, and the mutations were reverted.

| Mutation | Tests failed |
|---|---|
| `computeValidity`: `<=` → `<` | 1 |
| `multiInstanceItemAdd`: second write targets the extract tree, not the full tree | 1 |
| `extractPlainValue`: drop `EXTERNAL_AUTHORITY_INPUT_TYPES`, compare to `link` only | 14 |
| `findAnyValue`: revert to cursor-based satisfaction | 7 |
| `findAnyValue`: null guard returns a value | 1 |
| `configFlag`/`configText`: `Object.hasOwn` → a truthiness test | 2 |
| `configFlag`/`configText`: drop the `config != null` guard | 1 |
| `configFlag`: fall back to `false` rather than the current value | 2 |
| the parser stops reading `_ui._size` | 1 |
| `usable()` accepts zero as a size | 2 |
| video size falls back as a pair rather than per dimension | 1 |

`findAnyValue`'s null guard is the interesting entry. It **survived** the first time: the
null-node guard is unreachable from an instance CEE built, because CEE always
writes `{'@value': null}` rather than a bare null, so nothing exercised it.
Adding partial-instance cases — the kind a host page can inject — closed it.
Worth recording as the general lesson: a mutation that survives is usually
pointing at an untested branch, not at a redundant one.

## What it found

Three defects, all fixed.

**1. A filled required IRI-valued field never satisfied its requirement. — FIXED**

`changeValue` stores links and external authority fields as `{'@id': <iri>}`
with no `@value`. `extractPlainValue` returned the IRI only for
`InputType.link`; every other IRI-valued type fell through to the
controlled-term branch, read an absent `rdfs:label`, and counted as empty. A
form with a required ORCID could never report valid.

It affected **seven** input types: `ext-orcid`, `ext-ror`, `ext-pfas`,
`ext-pubmed`, `ext-rrid`, `ext-nih-grant-id`, `ext-doi`. That number was first
predicted by reading the code when only two were buildable; each of the other
five failed on arrival as the model library gained its builder, so the count
was demonstrated rather than inferred.

The fix has `extractPlainValue` consult `EXTERNAL_AUTHORITY_INPUT_TYPES` — the
set `DataObjectUtil.getEmptyValueWrapper` already used to decide these fields
get no `@value` in the first place. The report and the instance builder now
agree about which fields carry an IRI instead of each holding its own opinion,
and a future `ext-*` type added to that set is covered automatically.

Now a regression test, per type, in `test/cardinality.spec.ts` → "quality
report value extraction", with a companion asserting controlled terms are still
read from their label rather than their IRI.

**2. Validity depended on which page was on screen. — FIXED**

`buildRecursively` evaluated a multi element's children once against whichever
instance `currentIndex` pointed at, then cloned the result. Asking
`getDataObjectNodeByPath` whether a required field was filled therefore
answered only for the visible page. With three authors and the name filled on
page 2, the same instance reported:

| viewing | `isValid` |
|---|---|
| page 0 | false |
| page 1 | false |
| page 2 | true |

Settling the semantic made the fix small. Under **at least one instance must
carry a value** — which the counting side already implemented, since
`requiredFieldValueCount` was 1 rather than 3 — no per-instance evaluation is
needed, and therefore no cursor override and no collision with the shared
mutable `currentIndex`. The report now decides satisfaction with `findAnyValue`,
a cursor-free walk of the extract instance that branches into every array
entry. The value *tree* still shows the displayed page; only the counters are
page-independent, and a test pins that separation.

Still open as a product question, and pinned rather than assumed: whether an
element with **zero** instances should satisfy or violate a requirement. Today
it contributes no requirements and so reports vacuously valid. That predates
this fix and is untouched by it.

**3. Element visibility depended on the order of its element children. — FIXED**

In read-only mode with `hideEmptyFields`, `hasNonEmptyChild` looped a
component's children and, for element children, assigned the recursive result
without stopping — so the last element child decided the outcome and overwrote
any earlier `true`. An element holding data was reported empty whenever a later
sibling element happened to be empty, and the section silently disappeared from
the viewer. Nothing errored; the data was simply not shown. The field branch of
the same loop *did* stop, so this was an inconsistency inside one function
rather than a design choice.

Found by asking what read-only mode actually covered, and demonstrated by
rendering identical data in both sibling orders and getting opposite
visibility.

Both branches now return on the first non-empty child. The change only adds an
early exit on `true`, which makes it strictly monotonic toward visible — it
cannot hide anything that previously rendered. Regression tests cover both
orderings, a populated sibling between two empty ones, and the case that guards
the other direction: an all-empty subtree must still be hidden.

`hasNonEmptyChild` and the empty-field hiding it served have since been removed
with the `hideEmptyFields` config key, so this entry is a record of the defect
rather than a description of code that still runs. Its regression tests went with
it.

Related, and worth knowing rather than fixing: writing to an IRI-valued field
leaves `rdfs:label: undefined` on the node. `JSON.stringify` drops
undefined-valued keys, so the emitted JSON looks clean while
`'rdfs:label' in node` is still true.

## Getting it to run: four things that bit

Recorded because they are non-obvious and will bite again if the config is
rebuilt.

1. **A `resolveId` plugin, not `resolve.alias`.** The import that has to be
   intercepted is *relative*
   (`../components/…/cedar-embeddable-metadata-editor.component`). Vite resolves
   relative specifiers against the importer before alias regexes are consulted,
   so an alias silently never fires.
2. **`experimentalDecorators` must be forced via `esbuild.tsconfigRaw`.** CEE
   sets it in `tsconfig.base.json`, but esbuild reads the nearest
   `tsconfig.json`, where it is absent. Without it the `@Injectable()` decorator
   survives transform and node dies on `@__vite_ssr_import_0__.Injectable({`.
3. **Keep `deps.inline` narrow.** Inlining everything (`/.*/`) also inlines
   `vitest`, handing the spec files a second copy of `describe`/`it` that the
   runner never sees. The suite then "passes" having collected zero tests —
   the worst possible failure mode.
4. **`lodash-es` needs an explicit resolution.** CEE's handlers import it, but
   they live in `../src`, and node resolution from there walks up to a repo root
   with no `node_modules`.

## Enforced domain coverage

`npm run test:domain:coverage` measures all of `shared/` for visibility, but it
enforces aggregate thresholds only on the four Angular-free domain directories:

| Directory | Statements | Branches |
|---|---:|---:|
| `factory/` | 90% | 90% |
| `handler/` | 90% | 85% |
| `util/` | 90% | 85% |
| `validation/` | 90% | 85% |

The broad `shared/` percentage is not a gate. It includes Angular components,
pipes, REST models and services that this headless harness deliberately does not
load, so enforcing that aggregate would reward or punish unrelated file layout.
The grouped thresholds in `vitest.config.ts` fail the coverage command—and
therefore `npm run test:ci`—when domain coverage regresses below a floor.

## Input-type coverage is complete — and that is a moving target

All 24 of CEE's input types can be generated. It started at 19.

The five missing ones were `ext-pfas`, `ext-pubmed`, `ext-rrid`,
`ext-nih-grant-id` and `ext-doi` — types CEE could render but the CEDAR Model
TypeScript Library could not build, so the sweep silently skipped them. They
have since been added upstream and are covered here.

`test/coverage.spec.ts` now pins the ratio at 1 and keeps `UNCOVERED_INPUT_TYPES`
(empty) with its assertions intact. Their job is to fail the moment CEE grows a
25th input type without a matching builder, which is exactly how the first five
were found.

## A note on the stubs

`stubs/editor-component.ts` exists because
[`data-object-util.ts:157`](../src/app/modules/shared/util/data-object-util.ts)
reads a single static (`iriPrefix`) off the top-level Angular component. That
one read pulls the whole component subtree — HttpClient services, a
`package.json` import, and a circular edge back into `DataObjectUtil` — into
anything that touches the data-object builder.

Moving `iriPrefix` onto a plain constant would let both the stub and its alias
be deleted, and would remove a real circular import that currently survives only
because webpack tolerates it. Worth doing independently of this harness.
