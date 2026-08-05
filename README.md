# CEDAR Embeddable Editor (CEE)

The CEDAR Embeddable Editor (CEE) is a lightweight Web Component for adding
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

## Running as a standalone application

You can run CEE as a standalone application. This is helpful for developers to
see changes to the code reflected immediately in the application. The standalone
app loads a small sample template and instance from `src/assets/cee-demo`, so it
does not require a separate sample-template server or a
`cedar-component-distribution` checkout.

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

## Building the Webcomponent

This method creates a single Javascript (JS) file that encapsulates all the functionality of CEE. The JS file can be embedded in any application or HTML page. To build a CEE Webcomponent, proceed with these steps:

### Build and copy the Webcomponent JS file

1. Run the build command:
```shell
cedar-embeddable-editor$ ng build --configuration=production
```
1. Combine the generated files into a single file and copy the final JS to the sample application:
```shell
cedar-embeddable-editor$ cat dist/cedar-embeddable-editor/{runtime,polyfills,main}.js > cedar-embeddable-editor.js
```

## Running as an `npm` package

Stable releases remain available as
[`cedar-embeddable-editor`](https://www.npmjs.com/package/cedar-embeddable-editor)
on npmjs.org. Development builds are published to the BMIR Nexus as the scoped
package `@org.metadatacenter/cedar-embeddable-editor` under the `dev` tag:

```shell
npm config set @org.metadatacenter:registry https://nexus.bmir.stanford.edu/repository/npm-cedar/
npm install @org.metadatacenter/cedar-embeddable-editor@dev
```

An existing consumer can retain the unscoped dependency name with an npm alias:

```json
"cedar-embeddable-editor": "npm:@org.metadatacenter/cedar-embeddable-editor@<version>"
```

## Testing

The complete test gate is available from the repository root:

```shell
npm run test:ci
```

It runs, in order:

1. The Angular/Karma unit tests in headless Chrome.
2. The headless domain harness with V8 coverage.
3. A production build of the web component.
4. The Playwright suite against the concatenated production bundle, at desktop
   and narrow viewport sizes.

The domain corpora are checked into `harness/fixtures/`; running the tests does
not require `cedar-artifact-library` or `cedar-test-artifacts` checkouts.

### First-time setup

CEE resolves the model library from `@org.metadatacenter/cedar-model-typescript-library`,
published to the BMIR Nexus, so no sibling checkout is needed:

```shell
npm ci
npm --prefix harness ci
npm --prefix visual ci
./visual/node_modules/.bin/playwright install chromium
```

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
npm run test:unit:ci          # Angular/Karma, one headless run
npm run test:domain           # Vitest domain harness
npm run test:domain:coverage  # domain harness with coverage report
npm run test:visual           # production build, fixture preparation, Playwright
```

The legacy `npm test` command starts Angular/Karma in watch mode for interactive
development. Use `npm run test:ci` for a complete, non-interactive verification.

## Configuration

### Configuration file

The CEE configuration file format and storage location depends on the application and the mode in which CEE is being used.

* When running CEE in the standalone mode (developer mode), the configuration parameters are stored in and read from the file: `src/app/app.component.dev.ts`.
* When running CEE as a generic Webcomponent, the configuration parameters can be stored in any `.json` file that is visible to the application that embeds CEE Webcomponent. CEE Webcomponent API provides a method for loading the configuration file from its path at runtime. For example:
```javascript
document.addEventListener('WebComponentsReady', function () {
  const cee = document.querySelector('cedar-embeddable-editor');
  cee.loadConfigFromURL('assets/data/cee-config.json');
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

* **showSampleTemplateLinks:** Wether the sample links are shown or not.
  * For production this should be false, the template should be injected into the component by the embedding application
* **terminologyIntegratedSearchUrl:** The URL of the CEDAR integrated search endpoint that communicates with BioPortal.
  * The value `https://terminology.metadatacenter.org/bioportal/integrated-search` should work for the majority of applications.

```json
{
  "showSampleTemplateLinks": false,
  "terminologyIntegratedSearchUrl": 'https://terminology.metadatacenter.org/bioportal/integrated-search',
}
```

### Optional configuration parameters

There are other optional configuration parameters available for controlling various aspects of the CEE user interface. Most of these are self-explanatory. The example below includes the default values in cases, where the parameter isn't explicitly declared.

```json
{
  "sampleTemplateLocationPrefix": "/assets/cee-demo/",
  "loadSampleTemplateName": "demo",
  "expandedSampleTemplateLinks": true,
  "showTemplateDescription": false,

  "showTemplateRenderingRepresentation": true,
  "expandedTemplateRenderingRepresentation": false,

  "showInstanceDataCore": true,
  "expandedInstanceDataCore": false,

  "showMultiInstanceInfo": true,
  "expandedMultiInstanceInfo": false,

  "showInstanceDataFull": false,
  "expandedInstanceDataFull": false,

  "showTemplateSourceData": true,
  "expandedTemplateSourceData": false,

  "showDataQualityReport": false,
  "expandedDataQualityReport": false,

  "showHeader": true,
  "showFooter": true,

  "languageMapPathPrefix": null,
  "defaultLanguage": "en",
  "fallbackLanguage": "en",

  "collapseStaticComponents": false,
  "showStaticText": true,

  "inputSerialization": "json",
  "outputSerialization": "json",
  
  "readOnlyMode": false,
  "hideEmptyFields": false,
  "showPreferencesMenu": true
}
```

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

## Metadata API

CEE Webcomponent includes APIs for exporting metadata externally and importing metadata into CEE.

### Metadata Export

The metadata currently being edited inside CEE can be exported at anytime by making this API call:

```javascript
const meta = cee.currentMetadata;
```

`currentMetadata` always returns a CEDAR JSON object. CEE also exposes two
format-specific alternatives:

```javascript
const yaml = cee.currentMetadataYaml;             // always a YAML string
const selected = cee.currentMetadataSerialized;   // JSON object or YAML string
```

`currentMetadataSerialized` follows the `outputSerialization` configuration
value. It returns a JSON object by default and a YAML string when configured as
follows:

```json
{
  "outputSerialization": "yaml"
}
```

Input and output serialization are independent. Setting
`inputSerialization` to `"yaml"` selects the model library's YAML template
reader; the value assigned to `templateObject` must be the parsed YAML object,
not the YAML source string:

```javascript
cee.config = {
  // Include the other settings required by the embedding application.
  inputSerialization: 'yaml',
  outputSerialization: 'yaml'
};
cee.templateObject = parsedTemplateYaml;
```

Any value other than `"yaml"`, including an omitted value or `"json"`, selects
JSON serialization.

In the example below, the metadata is sent to an external endpoint every 15 seconds:

```javascript
document.addEventListener('WebComponentsReady', function () {
  const cee = document.querySelector('cedar-embeddable-editor');
  cee.loadConfigFromURL('assets/data/cee-config.json');
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

In the example below, the metadata is fetched from a remote URL and injected into CEE:

```javascript
function restoreMetadataFromURL(metaUrl, cee, successHandler = null, errorHandler = null) {
  const xhr = new XMLHttpRequest();
  xhr.onreadystatechange = () => {
    if (xhr.readyState === XMLHttpRequest.DONE) {
      if (xhr.status === 200) {
        const jsonMeta = JSON.parse(xhr.responseText);
        cee.instanceObject = jsonMeta;

        if (successHandler) {
          successHandler(jsonMeta);
        }
      } else {
        if (errorHandler) {
          errorHandler(xhr);
        }
      }
    }
  };
  xhr.open('GET', metaUrl, true);
  xhr.send();
}

document.addEventListener('WebComponentsReady', function () {
  const cee = document.querySelector('cedar-embeddable-editor');
  cee.loadConfigFromURL('assets/data/cee-config.json');
  restoreMetadataFromURL('uploads/metadata-for-restore.json', cee);
});
```

To reiterate, the metadata being injected **MUST** match the template currently being edited and open in your browser window.

### Injecting Template And Metadata Together

You can inject your template and metadata together into CEE:

```javascript
const templateAndInstance = {templateObject: object, instanceObject: object};
cee.templateAndInstanceObject = templateAndInstance;
```

Injecting template and metadata together brings performance benefits as well as allows configuring hiding empty fields.
Object being injected must strictly have two objects one named 'templateObject' and the other 'instanceObject'.

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

There is a sample applications you can use to demonstrate how to embed and use CEE.
Follow the links below to the demo application of your choice. The documentation for each demo application can be found in the README file of the corresponding application.

### CEE Demo Angular

This demo is written in Angular 2 and requires that framework to run properly.

https://github.com/metadatacenter/cedar-cee-demo/tree/main/cedar-cee-demo-angular-src
