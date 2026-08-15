# CEDAR Embeddable Editor (CEE)

The CEDAR Embeddable Editor (CEE) is a reusable Web Component for adding
structured, standards-based metadata authoring to web applications.

CEE dynamically renders data-entry forms from machine-actionable CEDAR
templates and produces semantically rich metadata as JSON-LD. Templates define
the fields, constraints, controlled vocabularies, and repeatable structures in a
form, allowing the metadata-authoring experience to evolve independently of the
application that embeds it. CEE also supports ontology-backed value selection
and persistent identifiers from external authorities such as ORCID and ROR.

For the design rationale, architecture, and deployments in research platforms,
see [*Author Once, Publish Everywhere: Portable Metadata Authoring with the CEDAR
Embeddable Editor*](https://doi.org/10.5334/dsj-2026-002), published in the
*Data Science Journal* (2026).

This README covers building, testing and releasing the component. For embedding
it in an application, the CEDAR documentation site carries a fuller guide:
[CEDAR Embeddable Editor](https://metadatacenter.readthedocs.io/en/latest/cedar-embeddable-editor/intro/).

## Browser support

CEE supports the browser targets of the Angular version each release is built
with. It requires native Custom Elements v1 and native Shadow DOM.

Automated compatibility tests run against current desktop Chromium, Firefox and
WebKit engines. Firefox ESR and the configured Edge, Safari and iOS versions are
compilation targets, but are not all exercised as separate browser products.

Internet Explorer, legacy EdgeHTML, and browsers or embedded web views without
native `window.customElements` and Shadow DOM support are not supported. CEE
does not polyfill its host page. Consumers choosing to support browsers outside
this contract must load and maintain their own Web Components polyfills before
loading CEE.

## Running as a standalone application

You can run CEE as a standalone application. This is helpful for developers to
see changes to the code reflected immediately in the application. The standalone
app fetches a small template and instance from `src/assets/cee-demo` and assigns
them to `templateAndInstanceObject`, the same way any host supplies an artifact,
so it needs no separate template server and no `cedar-component-distribution`
checkout.

Proceed with the following steps:

### Clone the repository

Clone this repository onto a local directory of your choice:

```shell
git clone https://github.com/metadatacenter/cedar-embeddable-editor.git
```

### Edit configuration

1. Open the file ```cedar-embeddable-editor/src/app/app.component.dev.ts``` in your favorite editor.
2. Edit configuration parameters based on your local environment (see section [Configuration](https://github.com/metadatacenter/cedar-embeddable-editor/tree/develop#configuration) for details).

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

## Building the Web Component

CEE is shipped as one JavaScript file that can be embedded in an application or
HTML page. Do not concatenate named Angular output files manually: their names,
locations, and module structure change when Angular changes builders.

Build the production application, then run the browser suite against the
single-file bundle it produced:

```shell
nvm use
npm run build:production
npm run test:visual:prebuilt
```

One Node version throughout — 24.19.0, which `.nvmrc` names. The build and the
tests used to run on different ones, because Angular 14's toolchain and the
Playwright the suite needs did not accept the same version; from Angular 15 they
do, so the dist that ships is produced on the same Node that exercised it.

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

`1.6.0` is current. A dev-snapshot channel on the BMIR Nexus, published as the
scoped `@org.metadatacenter/cedar-embeddable-editor` under a `dev` tag, is retired:
`scripts/npm-package.mjs` emits the unscoped package for the default registry.

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
5. A production build, then the Playwright suite against that bundle: the full
   Chromium baseline at desktop and narrow viewport sizes, plus focused
   Chromium, Firefox and WebKit compatibility checks.
6. Staging the npm package from the bundle the suite just exercised, which
   checks the raw and gzip size budgets and verifies every staged byte against
   its source.

The domain corpora are checked into `harness/fixtures/`; running the tests does
not require `cedar-artifact-library` or `cedar-test-artifacts` checkouts.

`.github/workflows/test.yml` runs the same gate on every pull request and on
pushes to `main`, `develop` and the `cee-angular-**` branches. Nothing is
published from CI: releasing is a separate, manual procedure.

### Auditing what ships

```shell
npm run audit:prod
```

Only runtime dependencies reach the file an embedder downloads, so this audit is
the one that describes the shipped artifact, and it is deliberately not part of
`test:ci` — it can fail on a disclosure rather than on a commit, which would
break an unrelated pull request its author cannot fix.

A root `npm audit` reports advisories against `@angular/cli` and the packages
reached through it. **Never run `npm audit fix --force` here.** npm's idea of
fixing that tree is to walk the toolchain years backwards, undoing the Angular
march to silence warnings about build tooling an embedder never downloads.

### First-time setup

CEE resolves the model library from `@org.metadatacenter/cedar-model-typescript-library`,
published to the BMIR Nexus, so no sibling checkout is needed:

```shell
npm ci
npm --prefix harness ci
npm --prefix visual ci
./visual/node_modules/.bin/playwright install chromium firefox webkit
```

### Node versions during the Angular migration

The root `.nvmrc` pins the Node version used to update, lint and compile the
current Angular version. Move that pin with each completed framework hop.

CEE is on **Angular 22.1** and **Node 24.19.0**, named in `.nvmrc`, declared in
`engines`, and pinned by CI. Angular 22 accepts `^22.22.3 || ^24.15.0 || >=26`; 24
is the active LTS where 22 is in maintenance, so that is the one CEE uses.

Build and test share it. Through Angular 14 they could not: no Node version
satisfied both that toolchain and the test tools, so CI built on one and switched
the runner to another without replacing `dist`. `npm run test:ci:prebuilt` is what
remains of that arrangement — it tests an already-built artifact and deliberately
does not invoke `ng build`, which is still what CI wants, because it means the
bytes tested are the bytes that ship.

Only that one package comes from Nexus; everything else resolves from npmjs.org.
An `.npmrc` alongside each of the three `package.json` files maps the
`@org.metadatacenter` scope to Nexus, and reads need no credentials.

Each manifest depends on it under an alias:

```json
"cedar-model-typescript-library": "npm:@org.metadatacenter/cedar-model-typescript-library@<version>"
```

The alias keeps the local import name, so source files import
`cedar-model-typescript-library` regardless of the published name. To move to a
newer build, publish it to Nexus and bump the version in the root, `harness/`,
and `visual/` manifests together.

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

The unit tests run in Node rather than a browser. None of them uses `TestBed`, so
none needs Angular's JIT compiler to build a component, and dropping the browser
took the suite from a Chrome launch to about a second. Anything that does need a
real browser belongs in the Playwright suite under `visual/`, which tests the
shipped bundle rather than the sources.

## Configuration

### Configuration file

The CEE configuration file format and storage location depends on the application and the mode in which CEE is being used.

* When running CEE in the standalone mode (developer mode), the configuration parameters are stored in and read from the file: `src/app/app.component.dev.ts`.
* When running CEE as a generic Webcomponent, the configuration parameters can be stored in any `.json` file that is visible to the application that embeds CEE Webcomponent. Fetch it and assign the result:
```javascript
customElements.whenDefined('cedar-embeddable-editor').then(async () => {
  const cee = document.querySelector('cedar-embeddable-editor');
  cee.config = await (await fetch('assets/data/cee-config.json')).json();
});
```
* The configuration can also be passed into the editor as a json map. In Angular this looks as follows:
```html
<cedar-embeddable-editor
  [config]="conf"
  [templateObject]="template"
  [instanceObject]="instance"
></cedar-embeddable-editor>
```


### Required configuration parameters

One key has no useful default:

* **terminologyIntegratedSearchUrl:** the URL of the CEDAR integrated search endpoint
  that communicates with BioPortal. `https://terminology.metadatacenter.org/bioportal/integrated-search`
  works for most applications.

```json
{
  "terminologyIntegratedSearchUrl": "https://terminology.metadatacenter.org/bioportal/integrated-search"
}
```

### Optional configuration parameters

Every other key is optional. The defaults below are the component's own, read
from `CedarEmbeddableMetadataEditorComponent` and its wrapper, not from the
standalone developer app in `src/app/app.component.dev.ts`, whose values differ.

What the user sees:

| Key | Default |
|---|---|
| `showTemplateDescription` | `false` |

CEE draws no page chrome of its own. It used to render a header carrying the CEDAR
logo and title, and a footer carrying the Stanford Division of Computational
Medicine mark and a contact link, behind `showHeader` and `showFooter`. Every string
and destination was hardcoded, so an embedder took CEDAR's branding or nothing.
A host renders its own header and footer around the element; the standalone app in
`src/app/app.component.dev.html` is a worked example.

What CEE keeps is the CEDAR mark and the version stamp inside the form's own title
block, which is a component naming itself rather than dressing someone else's page.

Editing behaviour and serialization:

| Key | Default |
|---|---|
| `readOnlyMode` | `false` |
| `trustTemplateRichText` | `false` |

`showDownloadMenu` offers a menu that saves CEE's views of the artifact as files.
It defaults to `false`, and nothing is rendered under the form either way:

| Menu entry | Saves | As |
|---|---|---|
| JSON-LD - Instance - Core | The instance without its envelope | `<name>-instance-core.json` |
| JSON-LD - Instance | The instance as a CEDAR document | `<name>-instance.json` |
| YAML - Instance | The same instance, as CEDAR YAML | `<name>-instance.yaml` |
| JSON Schema - Template | The template as the host supplied it | `<name>-template.json` |
| YAML - Template | The same template, as CEDAR YAML | `<name>-template.yaml` |
| Template Rendering Data | The component tree CEE built | `<name>-rendering.json` |
| Multi-Instance Information | Occurrence counts and current indices | `<name>-multi-instance.json` |
| Data Quality Report | Required-field tally and constraint violations | `<name>-data-quality.json` |

`<name>` is the template's own `schema:name`, reduced to file-name-safe
characters, so a developer with several forms open can tell the files apart.

These were eight panels once, each printing a dump under the form, and each
costing two keys — one to show it and one to expand it. Two of the sixteen were
on by default, so an embedder who configured nothing got a JSON Schema dump and
a JSON-LD dump beneath every form.

A download is started by the page, which a host running under a restrictive
sandbox can refuse, with no event to observe when it does. CEE traces each
attempt through the event handler, so a developer seeing the trace and no file
knows to look at their own sandbox.

Language, and the IRI prefixes CEE recognises or mints:

| Key | Default |
|---|---|
| `defaultLanguage` | `en` |
| `fallbackLanguage` | `en` |
| `languageMapPathPrefix` | none |
| `iriPrefix` | `https://repo.metadatacenter.org/` |
| `bioPortalPrefix` | `https://bioportal.bioontology.org/ontologies/` |
| `orcidPrefix` | `https://orcid.org/` |
| `rorPrefix` | `https://ror.org/` |

`trustTemplateRichText` decides whether a template author's rich text renders verbatim
or is sanitized first. It defaults to `false` and should stay there unless your
application controls which templates load — see [Embedding security](#embedding-security).

External-authority fields (ORCID, ROR, PFAS, PubMed, RRID, NIH Grant and DOI)
use CEDAR's production bridge by default. A host using another CEDAR deployment
can override the base URL; it must include a trailing slash:

```json
{
  "extAuthBaseUrl": "https://bridge.metadatacenter.org/ext-auth/"
}
```

CEE appends an authority-specific search or details path to this base. Those
paths can also be overridden independently with the following configuration
keys:

| Authority | Search path key | Details path key | Default paths |
|---|---|---|---|
| ORCID | `orcidIntegratedExtAuthUrl` | `orcidIntegratedDetailsUrl` | `orcid/search-by-name`, `orcid` |
| ROR | `rorIntegratedExtAuthUrl` | `rorIntegratedDetailsUrl` | `ror/search-by-name`, `ror` |
| PFAS | `pfasIntegratedExtAuthUrl` | `pfasIntegratedDetailsUrl` | `comp-tox/search-by-name`, `comp-tox` |
| PubMed | `pmidIntegratedExtAuthUrl` | `pmidIntegratedDetailsUrl` | `pmid/search-by-name`, `pmid` |
| RRID | `rridIntegratedExtAuthUrl` | `rridIntegratedDetailsUrl` | `rrid/search-by-name`, `rrid` |
| NIH Grant | `nihGrantIntegratedExtAuthUrl` | `nihGrantIntegratedDetailsUrl` | `nih-grant/search-by-name`, `nih-grant` |
| DOI | `doiIntegratedExtAuthUrl` | `doiIntegratedDetailsUrl` | `doi/search-by-name`, `doi` |

Enabling of hiding empty fields is only possible in read-only mode.

### TypeScript types

The package ships declarations. A host importing them gets a checked configuration
object and a typed element:

```ts
import type { CeeConfig, CedarEmbeddableEditorElement } from 'cedar-embeddable-editor';

const config: CeeConfig = { readOnlyMode: true, showTemplateYaml: true };

// Typed by the package, with no cast: it declares the tag in HTMLElementTagNameMap.
const cee = document.querySelector('cedar-embeddable-editor');
cee!.config = config;
const report = cee!.dataQualityReport;   // CeeDataQualityReport
```

The declarations are **types only**. The bundle is a script that registers a custom
element and exports no values, so there is nothing to import at runtime — use
`import type`, and let the interface rather than a constant catch a mistyped key.

If you are not using TypeScript, or your configuration comes from a JSON file no
compiler has seen, CEE checks it at runtime instead and reports what it cannot use.
An unknown key is named, with the nearest real key suggested; a value of the wrong
kind says what was expected; and settings that conflict are called out. The messages
go to the console and to any `eventHandler` you registered:

```
CEE ERROR: Unknown configuration key "readOnlyMod". It has no effect. Did you mean "readOnlyMode"?
```

Reporting only: a key CEE cannot use is ignored, exactly as before. The change is
that you are told rather than left watching a setting do nothing.

Every input on the element takes one assignment and keeps it. Assign `config` a
second time, or an artifact input a second time, and CEE reports it and ignores it:
the first value stands. Build the configuration you want, assign it once, and create
a new element if it has to change.

`readOnlyMode` is the only way in or out of read-only mode. CEE used to offer the
user a switch of its own, in a preferences menu, which wrote to the same state the
widgets read — so a form you embedded as a viewer could be made editable from inside
it. Both are gone, along with the `showPreferencesMenu` key that governed the menu.

## Embedding security

CEE renders inside your page, in your origin. It is a custom element using Shadow
DOM, and **Shadow DOM is not a security boundary**: it scopes styles and markup, not
privileges. Anything CEE executes runs with the same access to cookies, storage and
network as the rest of your application.

That matters for one input in particular.

### Templates are trusted input

A template can carry a **static rich-text field**, whose body is HTML composed by the
template's author and rendered as HTML by CEE. Instance data is different and is
always sanitized — a value a form's user typed can never introduce markup that runs.
The question is only what a *template author* may do.

CEE sanitizes template rich text by default. Script elements, event-handler
attributes such as `onerror`, `javascript:` URLs, `iframe`, `form` controls and
AngularJS directive attributes such as `ng-click` are removed. Formatting is
preserved: inline styles, tables, lists, headings, links, and inline `data:` images
in the raster formats all render as the author composed them.

If your application decides which templates load — they ship with the application, or
come from a source you control — you may prefer the author's markup to render exactly
as written:

```json
{
  "trustTemplateRichText": true
}
```

**Only set this if template authors are as trusted as your own application code.**
With it on, a template author can run JavaScript in your origin. "Allowed to define a
form" and "allowed to run code in this page" are very different permissions, and this
key is where you say they are the same for your deployment.

In particular, **do not set it if your users choose their own templates** — from
CEDAR's public library, or from anywhere your users can write to. Leave it off and
CEE will render the formatting without the risk.

### What is sanitized where

| Content | Origin | Treatment |
|---|---|---|
| Static rich-text field body | Template author | Sanitized, unless `trustTemplateRichText` is on |
| Static section break, image, YouTube | Template author | Not rendered as HTML; content is used as text or a URL |
| Field values, in the form and in read-only view | Instance data | Always sanitized. Not configurable |

## Metadata API

CEE Webcomponent includes APIs for exporting metadata externally and importing metadata into CEE.

### Metadata Export

The metadata currently being edited inside CEE can be exported at anytime by making this API call:

```javascript
const meta = cee.currentMetadata;
```

`currentMetadata` always returns a CEDAR JSON object. For YAML, read the
companion accessor instead:

```javascript
const yaml = cee.currentMetadataYaml;   // always a YAML string
```

Either accessor works whatever form the template arrived in. A template written
as CEDAR YAML is assigned to `templateObject` like any other, as the parsed YAML
object rather than the YAML source string, and CEE picks the reader from the
template's own shape:

```javascript
cee.templateObject = parsedTemplateYaml;
```

In the example below, the metadata is sent to an external endpoint every 15 seconds:

```javascript
customElements.whenDefined('cedar-embeddable-editor').then(async () => {
  const cee = document.querySelector('cedar-embeddable-editor');
  cee.config = await (await fetch('assets/data/cee-config.json')).json();
  const saveTime = 15000; // 15 seconds

  setInterval(() => {
    const meta = cee.currentMetadata;

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "http://localhost:8001/metadatasave.php");
    xhr.setRequestHeader("Accept", "application/json");
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(JSON.stringify(meta, null, 2));
    console.log('Saved metadata after ' + saveTime / 1000 + ' seconds');
  }, saveTime);
});
```

### Template Injection

You can inject your template into CEE:

```javascript
cee.templateObject = yourCustomTemplateJson;
```

### Metadata Injection

You can inject your metadata into CEE, provided it matches the template currently being edited:

```javascript
cee.instanceObject = yourCustomMetadataJson
```

`templateObject` and `instanceObject` are independent, and either may be assigned
first: CEE does not build the form until a template is present, so an instance
supplied ahead of one waits rather than loading against nothing.

Each takes one assignment. Fetch the metadata before you assign it, rather than
assigning a placeholder and correcting it once the fetch lands:

```javascript
customElements.whenDefined('cedar-embeddable-editor').then(async () => {
  const cee = document.querySelector('cedar-embeddable-editor');
  cee.config = await (await fetch('assets/data/cee-config.json')).json();
  cee.instanceObject = await (await fetch('uploads/metadata-for-restore.json')).json();
  cee.templateObject = yourCustomTemplateJson;
});
```

To load a different instance, create a new element. Reassigning `instanceObject`
reports an error and leaves the first instance in place.

To reiterate, the metadata being injected **MUST** match the template currently being edited and open in your browser window.

### Injecting Template And Metadata Together

You can inject your template and metadata together into CEE:

```javascript
const templateAndInstance = {templateObject: object, instanceObject: object};
cee.templateAndInstanceObject = templateAndInstance;
```

Injecting template and metadata together brings performance benefits as well as allows configuring hiding empty fields.
Object being injected must strictly have two objects one named 'templateObject' and the other 'instanceObject'.

### Temporal Values

CEE treats a temporal field's declared `temporalType`, `temporalGranularity`
and `timezoneEnabled` settings as its storage contract. The editor shows only
the parts named by that contract and emits a complete lexical `xsd:date`,
`xsd:time` or `xsd:dateTime` value:

| Declared precision | Canonical stored example |
| --- | --- |
| date, year | `2026-01-01` |
| date, month | `2026-08-01` |
| date, day | `2026-08-09` |
| time, hour | `21:00:00` |
| time, minute | `21:45:00` |
| time, second | `21:45:32` |
| time, decimal second | `21:45:32.001` |
| date-time, day | `2026-08-09T00:00:00` |
| date-time, minute | `2026-08-09T21:45:00` |

The same padding rule applies to the other date-time granularities. If time
zones are enabled, CEE appends the selected fixed offset (`Z` or `+/-HH:mm`);
if they are disabled, any offset is removed.

Granularity is authoritative when an existing instance is loaded. Information
finer than the declared granularity is intentionally discarded and the
canonical value is written back. For example,
`2026-08-09T21:45:32.125-07:00` in a day-granularity date-time field becomes
`2026-08-09T00:00:00-07:00`. Embedders should account for that normalization
when comparing a saved instance with its original input.

### Data Quality Report

The dataQualityReport summarizes basic metrics on the instance data.

```javascript
const report = cee.dataQualityReport;
```

The report answers two questions: is anything required missing, and is anything
present invalid.

```
requiredFieldValueCount: int
nonNullRequiredFieldValueCount: int
problems: ValidationProblem[]
isValid: boolean
```

`isValid` is true when nothing required is missing **and** `problems` is empty.

Each problem names the field and what is wrong with it:

```javascript
{
  path: ['_author', '_email'],   // component path from the template root
  field: '_email',
  inputType: 'email',
  code: 'email',                 // stable, matchable without parsing the message
  message: 'Not a valid email address.',
  value: 'not-an-email'
}
```

Constraints checked: `requiredValue`; `minLength`, `maxLength` and `regex`;
email, link, phone and external-authority IRI format; numeric type — including
`xsd:decimal`, `xsd:byte` and `xsd:short` — with the type's own range,
`minValue`, `maxValue` and `decimalPlace`; temporal shape against
`temporalType`, `granularity` and `timezoneEnabled`, plus calendar validity;
membership of a value in its declared choice literals; `minItems` and
`maxItems`; and the structure of a controlled-term value.

Controlled-term **membership** — whether a term belongs to the declared
ontologies, value sets, classes or branches — is not checked. It requires the
terminology server, and a local synchronous report should not depend on the
network. Structural checks on controlled values (`@id` and `rdfs:label` present
as a pair, `@id` well-formed) are performed.

An absent value produces no constraint problems; that is the required check's
business, so an empty form reports what is missing rather than also reporting
every blank as malformed.

### Language Maps / Translations

The application currently has two built-in language maps: `en` and `hu`. If you do not specify any language-related config option, the default `English` map will be used.

If you wish to change the language to another built-in one (currently the only other language is `Hungarian`), specify the config like below:

```json
{
  "defaultLanguage": "hu",
  "fallbackLanguage": "en"
}
```

You can use external language maps as well. In order to do this, specify a relative path to a folder containing the language file. The file should be named `x.json`, and should have the identical structure of the language map found in the source of the application:

https://github.com/metadatacenter/cedar-embeddable-editor/blob/main/src/assets/i18n-cee/en.json

In order to use an external language file, specify the config as follows:

```json
{
  "languageMapPathPrefix": "/assets/i18n-cee/",
  "defaultLanguage": "de",
  "fallbackLanguage": "en"
}
```

In the example above we want to use a `German` language file, which is located in the specified directory. Starting the path with `/` makes the path absolute. 

In our case the `/assets/i18n-cee/de.json` will be loaded if present.

If the file is missing, the `/assets/i18n-cee/en.json` will be used.

If that file is also missing, the built-in `de` map would be the next. As this does not exist at this moment, the last option, the built-in `en` map will be used.

Information about the loading process is logged onto the console with the `CEE TRACE` prefix. 

### Listening for changes

If you need to listen to data changes inside the embeddable editor, you can use the existing `change` DOM events. We added custom events in case of a multi-instance add, copy and delete operations, so you can listen to all the events on the instance.

An example in Angular is:

- `component.html`:
```html
<cedar-embeddable-editor
  [config]="conf"
  [templateObject]="template"
  [instanceObject]="instance"
  (change)="logChange($event)"
></cedar-embeddable-editor>
```

- `component.ts`:
```typescript
  logChange(event) {
    console.log('CHANGE', event);
  }
```

### Viewer Mode

CEE can be used as a viewer to display metadata instances. This can be achieved by the following configuration setting:

```json
"readOnlyMode": true
```
When used in this mode, users won't be able to manipulate the metadata instance but can only read it.
## Example Applications

[`cedar-component-demo`](https://github.com/metadatacenter/cedar-component-demo)
holds small runnable applications that embed CEE, each with its own README:

| Application | Framework |
|---|---|
| `cedar-cee-demo-angular-src` | Angular |
| `cedar-cee-demo-react` | React |
| `cedar-cee-demo-ember-src` | Ember |

Each edits the same template, `eDNA ECT Demonstration`, kept as a file inside the
application rather than fetched from a server.

`cedar-cee-demo-angular-src` needs `npm install --legacy-peer-deps`; the others
do not.
