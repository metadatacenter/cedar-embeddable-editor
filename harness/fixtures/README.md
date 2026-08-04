# Vendored test fixtures

These fixtures are checked into CEE so the domain harness is hermetic. A test
run must not become weaker because another CEDAR repository is absent from the
workspace.

## Independent corpus

`corpus/` contains only the canonical files consumed by the harness:

- 37 JSON templates and their YAML equivalents
- 21 JSON instances

Source: `metadatacenter/cedar-test-artifacts`, branch `develop`, commit
`ed02edd4974000ad694c150c4da1051c92739b97`.

To refresh it, copy `template-NNN.json`, `template-NNN.yaml`, and
`instance-NNN.json` from that repository's `artifacts/templates/` and
`artifacts/instances/` trees. Do not copy generated library outputs or the
larger `cee-suite` corpus unless a test is added for them.

## HuBMAP corpus

`hubmap/` contains 57 production template JSON files.

Source: `metadatacenter/cedar-artifact-library`, branch `develop`, commit
`98fe90ca25c9b6e79619488cb7ad100d34c2cd99`, directory
`src/test/resources/templates-json/`.

When refreshing either corpus, run the full harness and review every changed
tree snapshot. Updating a fixture and its snapshot together is a claim that the
new interpretation is intentional.
