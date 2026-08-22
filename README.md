# CEDAR Embeddable Editor (CEE)

The CEDAR Embeddable Editor (CEE) is a reusable Web Component for adding
structured, standards-based metadata authoring to web applications.

The CEE dynamically renders data-entry forms from machine-actionable CEDAR
templates and produces semantically rich metadata as JSON-LD. Templates define
the fields, constraints, controlled vocabularies, and repeatable structures in a
form, allowing the metadata-authoring experience to evolve independently of the
application that embeds it. The CEE also supports ontology-backed value selection
and persistent identifiers from external authorities such as ORCID and ROR.

For the design rationale, architecture, and deployments in research platforms,
see [*Author Once, Publish Everywhere: Portable Metadata Authoring with the CEDAR
Embeddable Editor*](https://doi.org/10.5334/dsj-2026-002), published in the
*Data Science Journal* (2026).

For embedding and using the CEE in a web application, see the
[CEDAR Embeddable Editor documentation](https://metadatacenter.readthedocs.io/en/latest/cedar-embeddable-editor/intro/).

This README covers developing, building, testing, and releasing the component.

## Building the Web Component

The CEE is shipped as one JavaScript file that can be embedded in an application or
HTML page. Do not concatenate named Angular output files manually: their names,
locations, and module structure change when Angular changes builders.

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

This copies the tested bytes to
`dist-npm/cedar-embeddable-editor/cedar-embeddable-editor.js`, refreshes its
version, README, changelog, and package lock, and records the bundle manifest.
The command fails if the browser bundle is stale or does not match its SHA-256
digest. `npm run check:npm-package` can repeat the byte-for-byte verification
before `npm pack` or `npm publish`.

## Running as an `npm` package

Releases are published to npmjs.org as
[`cedar-embeddable-editor`](https://www.npmjs.com/package/cedar-embeddable-editor)
under the `latest` tag, so an embedder installs the current one by name:

```shell
npm install cedar-embeddable-editor
```

The `latest` tag is the public stable channel. To see the current release without
depending on a version copied into this README:

```shell
npm view cedar-embeddable-editor version
```

## Running as a standalone application

You can run the CEE as a standalone application. This is helpful for developers to
see changes to the code reflected immediately in the application.

Proceed with the following steps:

### Clone the repository

Clone this repository onto a local directory of your choice:

```shell
git clone https://github.com/metadatacenter/cedar-embeddable-editor.git
```

### Edit configuration

1. Open the file ```cedar-embeddable-editor/src/app/app.component.dev.ts``` in your favorite editor.
2. Edit configuration parameters based on your local environment (see the [configuration documentation](https://metadatacenter.readthedocs.io/en/latest/cedar-embeddable-editor/configuration/) for details).

### Build the project and start the server

1. Navigate to the CEE directory:
```shell
$ cd <...>/<clone directory>/cedar-embeddable-editor/
```
1. Run these commands:
```shell
cedar-embeddable-editor$ npm install
cedar-embeddable-editor$ ng serve
```

1. In your browser, navigate to `http://localhost:4400/`. The app will automatically reload if you change any of the source files.

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

## Deploying the CEE in a Web Application

See the [CEDAR Embeddable Editor guide](https://metadatacenter.readthedocs.io/en/latest/cedar-embeddable-editor/intro/)
for deployment and integration instructions.
