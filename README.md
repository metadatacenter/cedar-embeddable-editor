# CEDAR Embeddable Editor (CEE)

[![Test](https://github.com/metadatacenter/cedar-embeddable-editor/actions/workflows/test.yml/badge.svg?branch=develop)](https://github.com/metadatacenter/cedar-embeddable-editor/actions/workflows/test.yml)

The CEDAR Embeddable Editor (CEE) puts a metadata entry form inside a web
application without anyone hand-writing that form. The host page supplies a
template, and the CEE renders the fields the template calls for, checks what the
user enters against the template's constraints, and returns the finished record
as structured metadata in JSON-LD or YAML.

A template describes the metadata to collect, not the interface that collects it.
It names the fields, their types and cardinalities, which of them repeat, and
which draw their values from a controlled vocabulary or from an identifier
authority such as ORCID or ROR. A platform can therefore adopt or revise a
metadata standard by editing a template rather than by rewriting a form. The
record that comes back preserves those bindings, since a controlled term carries
its IRI beside its label and an authority field carries its persistent
identifier.

Templates follow the model defined by CEDAR, the metadata infrastructure
maintained by the Stanford Division of Computational Medicine. Rendering a form
needs neither a CEDAR account nor a running CEDAR installation. The CEE ships as
a single JavaScript file defining a standard Web Component, so it embeds in a
plain HTML page as readily as in an Angular, React, or Ember application.

## Documentation

The [CEDAR Embeddable Editor documentation](https://metadatacenter.readthedocs.io/en/latest/cedar-embeddable-editor/)
covers embedding the component in a page or a framework, configuring it,
controlled terms and external identifiers, validation, appearance, and security.

[Your First Embedded Editor](https://metadatacenter.readthedocs.io/en/latest/cedar-embeddable-editor/first-editor/)
assembles a working page from the bundle, one element, and a template.
[Templates and Metadata](https://metadatacenter.readthedocs.io/en/latest/cedar-embeddable-editor/templates-and-metadata/)
gives the input properties, the output properties, and the change event a host
reads.

For the design rationale, the architecture, and deployments in research
platforms, see [*Author Once, Publish Everywhere: Portable Metadata Authoring
with the CEDAR Embeddable Editor*](https://doi.org/10.5334/dsj-2026-002),
published in the *Data Science Journal* (2026).

## Installing

Releases are published to npmjs.org as
[`cedar-embeddable-editor`](https://www.npmjs.com/package/cedar-embeddable-editor)
under the `latest` tag, the public stable channel, so an embedder installs the
current release by name:

```shell
npm install cedar-embeddable-editor
```

To see which release that is, without depending on a version copied into a
document that can go stale:

```shell
npm view cedar-embeddable-editor version
```

The package holds `cedar-embeddable-editor.js`, the self-contained bundle, and
`cedar-embeddable-editor.d.ts`, the declarations for the element and its public
API. Copy the bundle to the application's static assets and load it with a
regular `<script>` tag. The bundle loads as a classic script, not as an ES
module.

## Embedding

A host page needs the bundle, one `<cedar-embeddable-editor>` element, and a
template:

```html
<cedar-embeddable-editor></cedar-embeddable-editor>

<script src="/assets/cedar-embeddable-editor.js"></script>
<script type="module">
  const template = await (await fetch('/assets/dataset-template.json')).json();

  await customElements.whenDefined('cedar-embeddable-editor');
  const cee = document.querySelector('cedar-embeddable-editor');

  cee.config = {
    terminologyBaseUrl: 'https://terminology.metadatacenter.org/',
    bridgeBaseUrl: 'https://bridge.metadatacenter.org/',
  };

  cee.templateObject = template;
</script>
```

Templates, instances, and configuration are JavaScript objects, so a host assigns
them as properties rather than as attributes. Waiting for
`customElements.whenDefined()` guarantees the element exists. Set `config` before
the form is built, and assign `templateObject` last, which renders it. The two
service URLs are needed only for controlled-term and external-authority lookups.

Read the record back from `currentMetadata` as CEDAR JSON-LD, or from
`currentMetadataYaml` as YAML. The CEE neither submits nor stores it. The host
decides when and where a record is saved.

[Your First Embedded Editor](https://metadatacenter.readthedocs.io/en/latest/cedar-embeddable-editor/first-editor/)
takes the same page apart step by step, and
[Embedding in a Framework](https://metadatacenter.readthedocs.io/en/latest/cedar-embeddable-editor/frameworks/)
covers Angular, React, and Ember.

## Embedding a Single Field

The bundle registers a second element. `<cedar-embeddable-field>` renders one field's
control — the same control the editor renders for that field, from the same component
— and nothing of the form around it: no label, no description, no card. A host that
holds a field artifact rather than a template puts this where the control belongs and
draws the rest itself.

Designing a template is what this is for. An author giving a field a default value
needs somewhere to type it, and the box that collects one has to be the control the
field will actually have: a date picker for a date, a term lookup for a controlled
term, a bounded number box for a number.

```html
<cedar-embeddable-field></cedar-embeddable-field>

<script src="/assets/cedar-embeddable-editor.js"></script>
<script type="module">
  const artifact = await (await fetch('/assets/organism-field.json')).json();

  await customElements.whenDefined('cedar-embeddable-field');
  const field = document.querySelector('cedar-embeddable-field');

  field.config = { terminologyBaseUrl: 'https://terminology.metadatacenter.org/' };
  field.addEventListener('valueChange', (event) => console.log(event.detail.value));

  field.fieldObject = artifact;
</script>
```

A field artifact, not a field model. A host holding a `TemplateField` from the CEDAR
Model TypeScript Library — a designer that just built one, say — writes it out and
assigns the result rather than assigning the object.

Assigning the object costs nothing and looks as though it should work, which is why
this is worth stating. The element's copy of the model library sits inside the CEE
bundle and the host's sits inside its own, so the two hold different classes, and CEE
decides what a field is by identity: `field.cedarFieldType === CedarFieldType.TEXT`,
and `instanceof` in three dozen other places. Every one of those comparisons is false
for an instance built elsewhere, so the field renders as a default rather than
failing. A serialization also survives the two packages pinning different versions of
the model library, which shared objects would not. The editor's `templateObject`
takes an artifact for the same reason.

The value comes back as a discriminated union rather than as text, because the
distinctions are real ones a host has to make again the moment it writes the value
into an artifact: a number is a number, a term is an IRI with a label, and a checkbox
group holds a set.

```typescript
import type { CedarEmbeddableFieldChangeDetail, CedarEmbeddableFieldValue } from 'cedar-embeddable-editor';

declare function recordDefault(value: CedarEmbeddableFieldValue): void;

const field = document.querySelector('cedar-embeddable-field');

field?.addEventListener('valueChange', (event: CustomEvent<CedarEmbeddableFieldChangeDetail>) => {
  const { value, valid } = event.detail;
  if (valid) {
    recordDefault(value);
  }
});
```

`fieldObject` may be reassigned as often as a host likes, and each assignment builds
the control afresh — the field being designed changes type under its author's hand.
`config` takes one assignment, as the editor's does. A value of a kind the field
cannot hold is reported through `eventHandler` and ignored rather than coerced.

Requiredness and cardinality belong to a field's deployment inside a template, and
this element deploys nothing, so the value it acquires is single and is allowed to be
absent. That is what makes it usable for a default, which is optional by definition. A
field declaring its own default starts out holding it.

`readOnlyMode` is the presentation half of the same element: with a value it shows the
value, and with none it replaces the control with a statement of what the field will
accept, which is what the editor shows for a template nobody has filled in.

## Building the Web Component

One command produces the single file an embedder loads. Do not concatenate named
Angular output files manually: their names, locations, and module structure change
when Angular changes builders.

Build the production application, then run the browser suite against the
single-file bundle it produced:

```shell
nvm use
npm run build:production
npm run test:visual:prebuilt
```

Use Node 24.19.0, which `.nvmrc`, `package.json` and CI all specify. The build and
tests use that same version, so the distribution is produced by the toolchain
that exercises it.

Once that exact bundle is green, stage the publishable npm directory from it:

```shell
npm run package:npm:prebuilt
```

For a release candidate, `npm run test:package` performs both operations in one command: it builds
and browser-tests the production bundle, then stages and verifies the package from those exact
tested bytes.

This copies the tested bytes to
`dist-npm/cedar-embeddable-editor/cedar-embeddable-editor.js`, refreshes its
version, README, changelog, and package lock, and records the bundle manifest.
The command fails if the browser bundle is stale or does not match its SHA-256
digest. `npm run check:npm-package` can repeat the byte-for-byte verification
before `npm pack` or `npm publish`.

## Testing

The complete test gate is available from the repository root:

```shell
npm run test:ci
```

It runs, in order:

1. `ng lint` over the sources and the ESLint configuration.
2. A type check of the application and the domain harness, with `strict` on
   throughout.
3. The unit tests, in Node under Vitest.
4. The headless domain harness with V8 coverage, and its per-directory coverage
   floors.
5. A production build, then the Playwright suite against that bundle, in a
   container: the full Chromium baseline at desktop and narrow viewport sizes,
   plus focused Chromium, Firefox and WebKit compatibility checks. The container
   is what makes a screenshot baseline mean the same thing on a laptop and on CI,
   so the pixel budget is zero — see `visual/run-in-container.sh`.
6. Staging the npm package from the bundle the suite just exercised, which
   checks the raw and gzip size budgets and verifies every staged byte against
   its source.

The domain corpora are checked into `harness/fixtures/`; running the tests does
not require `cedar-artifact-library` or `cedar-test-artifacts` checkouts.

`.github/workflows/test.yml` runs the same gate on every pull request and on
pushes to `main` and `develop`. Nothing is published from CI: releasing is a
separate, manual procedure.

### Auditing what ships

```shell
npm run audit:prod
```

Only runtime dependencies reach the file an embedder downloads, so this audit is
the one that describes the shipped artifact, and it is deliberately not part of
`test:ci` — it can fail on a disclosure rather than on a commit, which would
break an unrelated pull request its author cannot fix.

A root `npm audit` also reports on development tooling that is not shipped to an
embedder. **Never run `npm audit fix --force` here:** it can replace the declared
toolchain with incompatible major versions. Review and update affected
dependencies explicitly instead.

### First-time setup

The CEE resolves `cedar-model-typescript-library` from npmjs.org, so a sibling
checkout is not needed:

```shell
nvm use
npm ci
npm --prefix harness ci
```

The visual suite installs nothing here. It runs inside Playwright's own container,
which carries the browsers it drives, and installs its dependencies there against a
named volume — so it needs Docker running and no `playwright install` of its own.

The CEE uses Angular 22.1 and Node 24.19.0. `.nvmrc`, the package `engines` field and
CI specify the Node version.

The application bundle and the visual fixture generator each install the model
library directly from npmjs.org:

```json
"cedar-model-typescript-library": "<version>"
```

Keep the version in the root and `visual/` manifests, and both lockfiles, in
sync. The production bundle imports the root copy while the browser fixtures are
generated with the visual copy, so a mismatch means the tests and the artifact
are using different model contracts. The harness declares no separate copy; it
resolves the root installation.

### Focused test commands

Use these when working on one layer:

```shell
npm run test:unit:ci          # Vitest unit tests, one run
npm run test:unit:coverage    # unit tests with coverage report
npm run test:domain           # Vitest domain harness
npm run test:domain:coverage  # domain harness with coverage report
npm run test:bundle-size      # exact raw and gzip budgets for the shipped bundle
npm run test:visual           # production build, fixture preparation, Playwright
```

`npm test` runs the unit tests once, and `npm run test:watch` keeps them running
for interactive development. Use `npm run test:ci` for a complete verification.

The unit tests run in Node and do not use `TestBed` or Angular's JIT compiler.
Browser behavior belongs in the Playwright suite under `visual/`, which tests the
shipped bundle rather than the sources.

## Running the Standalone Application

The CEE also runs on its own, outside any host page, which shows a change to the
sources immediately in a browser.

### Clone the repository

Clone this repository onto a local directory of your choice:

```shell
git clone https://github.com/metadatacenter/cedar-embeddable-editor.git
```

### Edit configuration

Open the standalone application's configuration file, `src/app/app.component.dev.ts`.
This minimal configuration enables lookups through the public CEDAR services:

```typescript
import type { CeeConfig } from 'cedar-embeddable-editor';

const ceeConfig: CeeConfig = {
  terminologyBaseUrl: 'https://terminology.metadatacenter.org/',
  bridgeBaseUrl: 'https://bridge.metadatacenter.org/',
};
```

For a different CEDAR deployment, replace both URLs with its service URLs. See
the [configuration documentation](https://metadatacenter.readthedocs.io/en/latest/cedar-embeddable-editor/configuration/)
for all available settings.

### Build the project and start the server

1. Navigate to the CEE directory:

   ```shell
   cd <...>/<clone directory>/cedar-embeddable-editor/
   ```

2. Run these commands:

   ```shell
   npm install
   ng serve
   ```

3. In your browser, navigate to `http://localhost:4400/`. The app will
   automatically reload if you change any of the source files.
