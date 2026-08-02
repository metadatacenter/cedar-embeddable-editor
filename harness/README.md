# CEE Test Harness

A headless, generative test harness for the CEDAR Embeddable Editor's domain
layer — template parsing, instance construction, path resolution, value writes,
multi-instance mechanics, and the data quality report.

> **Status: 279 tests, all passing** on Node 20.20.2 / Vitest 1.6.
> Verified non-vacuous by mutation testing — see [Does it have teeth?](#does-it-have-teeth).

## Why this exists

CEE is on Angular 14 and needs to reach a supported version. The instinct is
"write tests first" — correct, but the obvious tests are the wrong ones.

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

Generative, not corpus-based. A pile of real templates has unknown coverage; an
enumeration of the decision space has coverage you can point at.
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
| `src/driver.ts` | Headless CEE — reproduces the wrapper's startup path without Angular |
| `stubs/angular-core.ts` | No-op decorators, so the harness never loads Angular |
| `stubs/editor-component.ts` | Breaks the `DataObjectUtil` → editor-component circular import |
| `test/coverage.spec.ts` | Drift detection: does the generator still cover every `InputType`? |
| `test/roundtrip.spec.ts` | The oracle, swept across the cross-product |
| `test/edge-cases.spec.ts` | Page breaks, static collapse, hidden fields, multi-instance, reload |

## Running it

The model library must be built first — the harness depends on its `dist/`, not
its source.

```bash
cd /Users/martin/CEDAR/cedar-model-typescript-library && npm install && npm run build
```

```bash
cd /Users/martin/CEDAR/cedar-embeddable-editor/harness && npm install && npm test
```

Requires Node 20 (`nvm use 20`). CEE's own Angular 14 toolchain wants Node 16–18,
so if you are switching between building the app and running these, expect to
switch Node versions too.

## Does it have teeth?

A suite that is green the day it is written is worth nothing until you have seen
it go red. Two mutations were applied to CEE source and both were caught:

| Mutation | Caught by |
|---|---|
| `computeValidity`: `<=` → `<` in `data-quality-report.model.ts` | `data quality report > counts required fields and flips to valid` |
| `multiInstanceItemAdd`: second `performItemAdd` writes to the extract tree instead of the full tree | `loading an existing instance > recovers multi-instance counts` |

Both were reverted; CEE source is unmodified by this harness.

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

## Known coverage gap

CEE `develop` declares 24 input types. The model library's `CedarBuilders`
facade exposes builders for 19 of them. Uncovered:

```
ext-pfas   ext-pubmed   ext-rrid   ext-nih-grant-id   ext-doi
```

All five landed on CEE `develop` with their lookup services but have no
counterpart in the library's facade. `ext-pfas` is closest — builder files exist
under `model/cedar/field/dynamic/ext-pfas/` but are not exported. All five are
shaped like `ExtOrcid`/`ExtRor`, so closing the gap is mechanical.

`test/coverage.spec.ts` asserts this list against CEE's `InputType`, so the gap
is reported rather than silently tolerated, and the suite fails if a sixth type
appears without acknowledgement.

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
