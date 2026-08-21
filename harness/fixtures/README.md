# Vendored test fixtures

These fixtures are checked into CEE so the domain harness is hermetic. A test
run must not become weaker because another CEDAR repository is absent from the
workspace.

## Independent corpus

`corpus/` contains only the canonical files consumed by the harness:

- 37 JSON templates and their YAML equivalents
- 21 JSON instances

Source: `metadatacenter/cedar-test-artifacts`, branch `develop`, commit
`775448d5a4013a708229fed8535d22e4fc1e6a65`.

To refresh it, copy `template-NNN.json`, `template-NNN.yaml`, and
`instance-NNN.json` from that repository's `artifacts/templates/` and
`artifacts/instances/` trees. Do not copy generated library outputs.

## CEE production-derived compatibility corpus

`cee-suite/` contains all 85 case directories from the shared corpus: 86
template files (including the retained `template-001-original.json`) and 57
paired instances. Case 086 intentionally contains malformed template JSON and
is declared as such by the loader; its instance remains part of the inventory.

Source: `metadatacenter/cedar-test-artifacts`, branch `develop`, commit
`51581826f047ba4b17a1a6464c41c14c468ee3cb`, directory
`artifacts/cee-suite/`.

## HuBMAP corpus

`hubmap/` contains 57 production template JSON files.

Source: `metadatacenter/cedar-artifact-library`, branch `develop`, commit
`aad2e8a6be35403d8831ddf300e94e0cb6f81660`, directory
`src/test/resources/templates-json/`.

These snapshots are mandatory test inputs. `harness/src/corpus.ts` checks the
expected corpus sizes and every numbered JSON/YAML pair. Missing or incomplete
fixtures fail test collection; corpus-backed suites must not be skipped.

When refreshing either corpus, run the full harness and review every changed
tree snapshot. Updating a fixture and its snapshot together is a claim that the
new interpretation is intentional.
