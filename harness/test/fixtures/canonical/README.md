# Canonical Validation Fixtures

Instance and template fixtures copied from CEDAR's canonical validator,
[cedar-model-validation-library](https://github.com/metadatacenter/cedar-model-validation-library),
where they live under `src/test/resources`. `validator-agreement.spec.ts` runs them through
CEE's `ajv-draft-04` validator and checks it reaches the same verdicts the Java library
requires: the seven instances that must pass, and the mutations of `many-fields-instance`
that must fail.

They are copied rather than read from a sibling checkout so the check runs everywhere.
The spec used to resolve `../../../cedar-model-validation-library`, which exists on a
developer machine with the full CEDAR tree but never in CI, where only CEE is checked
out. The result was 17 tests that silently skipped in CI while reporting green — the
agreement they assert was only ever verified locally.

Both repositories are BSD-licensed and carry the same copyright, The Board of Trustees of
Leland Stanford Junior University.

## Provenance

Taken from commit `03c1f25e25c2cf296f0d722dd25a4b7d14d16814`
("Allow the boolean field value-constraints shape in the meta-schema").

Only the 14 files the spec reads were copied, not the whole resources tree.

## The Cost of Copying, and How to Refresh

A copy freezes the arbiter. The point of this check is that a future CEDAR release can
tighten a rule `ajv` does not implement, and these fixtures are how that surfaces — but a
frozen copy cannot surface anything until it is refreshed. Treat an update to
cedar-model-validation-library as a reason to re-copy:

```bash
V=../cedar-model-validation-library/src/test/resources
for f in $(cd harness/test/fixtures/canonical && find instances templates -type f); do
  cp "$V/$f" "harness/test/fixtures/canonical/$f"
done
```

Then run `npm run test:domain` and record the new source commit above. A diff here is
meaningful: it means the canonical definition of a conforming instance has moved.
