# Roadmap

Work in flight across CEE and `cedar-model-typescript-library`, in dependency order.

The thread running through the first three items: CEE used to check its own output against
each template with `ajv`, which meant carrying a second validator and restating rules CEDAR
already defines. That was removed. The model library now answers the question through
`InstanceValidator.validate`, but CEE cannot call it until the library ships — so **nothing
currently catches a dropped `@type` or a missing property in CEE's output**. Closing that is
the point of items 1 to 3.

## Critical Path

1. **Release the library.** Decide whether the new reports are errors or warnings, whether
   this is `0.10.0` rather than `0.9.x`, and bump `package-dist.json` — it still carries
   `0.9.2-dev.20260804.f1a3784`, the version before any of this work. Everything CEE-side
   waits on this.

   The version question is real rather than ceremonial: `wasSuccessful()` on an instance
   parse could only ever return true before, and now can return false.

2. **Land CEE's conformance spec.** Written and proven — 117 tests, taking the domain suite
   from 2125 to 2242 — but held back because it cannot run against the published library.
   Parked at `harness/test/instance-conformance.spec.ts.pending`; rename to `.ts` once the
   dependency in `package.json` and `harness/package.json` moves.

3. **Attribute the multi-choice `minItems` finding.** A fresh checkbox with `minItems: 2`
   holds two empty slots; after a value is written it holds one, so the document no longer
   satisfies its template. Found by item 2 on its first run. Either CEE's write path
   replaces the list instead of filling a slot in it, or `CeeDriver.setValue` models the
   write too bluntly and it is the harness's. Reading the driver against what the widget
   does on a click settles it.

## Library

4. **Finish [issue #2](https://github.com/metadatacenter/cedar-model-typescript-library/issues/2).**
   An instance with no `@id`, no `schema:isBasedOn`, no provenance and an empty `@context`
   still reports `adheresToBlueprint() === true`. The reader's `knownKeys` already lists the
   envelope; nothing consults it. Reporting a null `@id` was the first write into that
   parsing result, and the rest of the envelope is the remainder of the issue.

5. **`[]` is read as an `InstanceDataAttributeValueField`.** An empty list is not an empty
   array, because without a template the reader cannot tell one from the other. Worked
   around in `InstanceValidator` with a comment rather than fixed, and it is the same class
   of defect as the null `@id` was.

6. **`wasSuccessful()` and `adheresToBlueprint()` are identical implementations**, both
   errors-only. Now that warnings carry real signal, one of them should probably mean
   "clean, including warnings".

7. **`JsonTemplateInstancetReader.ts`** — the transposed `t`.

8. **No CI.** 606 tests and nothing runs them on push.

## Corpus

These need someone who knows CEDAR's version history; they are not code changes.

9. **Temporal `required` is inconsistent.** Across the corpus, 28 templates require `@type`
   on a temporal value, 27 do not, and 12 require nothing. The library's blueprint
   comparison does not check field-level `required`, so it flags none of them.
   `InstanceValidator` requires `@type` always — stricter than roughly half the corpus, on
   the grounds that the field declares a `temporalType` and so the value is a typed literal.
   That was a judgement, and it should be an explicit one.

10. **`cee-suite/002` does not conform.** Its template declares `minItems: 10` on
    `Multi Text Field`; its instance carries two values. Recorded in `KNOWN_NONCONFORMANT`
    with a companion test that fails if it ever starts conforming.

## Deferred

11. **Widen instance validation to per-field value-node `required`.** A template states
    `required: ["@value"]` per field, so "this value node is missing the key its own schema
    demands" is checkable without inferring anything from `uiInputType` — which cannot be
    inferred from, since a `textfield` may hold a literal or an IRI depending on its value
    constraints. The model keeps no per-field `required` array, so this means consulting the
    blueprint per field kind.

12. **The cross-validator agreement check has no home.** Whether CEE's reading of
    conformance matches the canonical Java validator is worth knowing, cannot live in CEE,
    and needs both implementations reachable. A `cedar-development` job, if it is worth
    having at all.

## Recently Closed

- Templates CEDAR served between 2018 and 2024 are readable again: the corpus went from 100
  to 121 of 123 clean, with the older forms recorded as warnings rather than rejected, and
  `STRICT` left strict. The two that remain are the deliberately broken ones.
- `{"@id": null}` is reported rather than round-tripped in silence, at both the reader and
  the validator. `@value` may be null; `@id` may not.
- `InstanceValidator` exists, with the corpus as its false-positive net.
- CEE's lint gate runs and CI enforces it.
