# Cedar Embeddable Editor (CEE)

The CEDAR Embeddable Editor is as a web component that implements the functionality of the CEDAR Metadata Editor.

It takes CEDAR JSON Schema templates as input, and produces CEDAR JSON-LD metadata.

## Running as a standalone application

You can run CEE as a standalone application. This is helpful for developers to see changes to the code reflected immediately in the application. To run CEE in the standalone mode (NOT as a Webcomponent), you will need the editor itself and the sample templates that the editor uses. These are stored in a [separate repo](https://github.com/metadatacenter/cedar-component-distribution).

Proceed with the following steps:

### Clone the repository

Clone this repository onto a local directory of your choice:

```shell
git clone https://github.com/metadatacenter/cedar-embeddable-editor.git
git clone https://github.com/metadatacenter/cedar-component-distribution.git
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

1. In a different shell navigate to the component distribution directory:
```shell
$ cd <...>/<clone directory>/cedar-component-distribution/
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

Please import the latest version of the editor into your project from: [https://www.npmjs.com/package/cedar-embeddable-editor](https://www.npmjs.com/package/cedar-embeddable-editor)

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
  "sampleTemplateLocationPrefix": "http://localhost:4240/cedar-embeddable-editor-sample-templates/",
  "loadSampleTemplateName": "01",
  "expandedSampleTemplateLinks": true,

  "showTemplateRenderingRepresentation": true,
  "showInstanceDataCore": true,
  "expandedInstanceDataCore": false,
  "showMultiInstanceInfo": true,
  "expandedMultiInstanceInfo": false,

  "expandedTemplateRenderingRepresentation": false,
  "showInstanceDataFull": false,
  "expandedInstanceDataFull": false,
  "showTemplateSourceData": true,
  "expandedTemplateSourceData": false,

  "showHeader": true,
  "showFooter": true,

  "defaultLanguage": "en",
  "fallbackLanguage": "en",

  "collapseStaticComponents": false,
  "showStaticText": true
}
```

## Metadata API

CEE Webcomponent includes APIs for exporting metadata externally and importing metadata into CEE.

### Metadata Export

The metadata currently being edited inside CEE can be exported at anytime by making this API call:

```javascript
const meta = cee.currentMetadata;
```

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

## Example Applications

There is a sample applications you can use to demonstrate how to embed and use CEE.
Follow the links below to the demo application of your choice. The documentation for each demo application can be found in the README file of the corresponding application.

### CEE Demo Angular

This demo is written in Angular 2 and requires that framework to run properly.

https://github.com/metadatacenter/cedar-cee-demo/tree/main/cedar-cee-demo-angular-src