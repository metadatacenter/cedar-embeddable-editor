# Cedar Embeddable Editor (CEE)

The CEDAR Embeddable Editor is as a web component that implements the functionality of the CEDAR Metadata Editor.

It takes CEDAR JSON Schema templates as input, and produces CEDAR JSON-LD metadata.

## Running as a standalone application

You can run CEE as a standalone application. This is helpful for developers to see changes to the code reflected immediately in the application. To run CEE in the standalone mode (NOT as a Webcomponent), proceed with the following steps:

### Clone the repository

Clone this repository onto a local directory of your choice:

```shell
git clone https://github.com/metadatacenter/cedar-embeddable-editor.git
```

### Enable the standalone mode

1. Open the file ```cedar-embeddable-editor/src/app/app.module.ts``` in your favorite editor.
2. Uncomment the ```AppComponent``` line (it is commented out by default):
```typescript
  bootstrap: [
    // TODO: Uncomment this in order to make app runnable alone
    AppComponent
  ],
```
### Edit configuration

1. Open the file ```cedar-embeddable-editor/src/app/app.component.ts``` in your favorite editor.
2. Edit configuration parameters based on your local environment (see section [Configuration](https://github.com/metadatacenter/cedar-embeddable-editor/tree/develop#configuration) for details).

### Build the project and start the server

1. Navigate to the CEE directory:
```shell
$cd <...>/<clone directory>/cedar-embeddable-editor/
```
2. Run these commands:
```shell
cedar-embeddable-editor$ npm install
cedar-embeddable-editor$ ng serve
```
3. In your browser, navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

## Running as a Webcomponent

This method creates a single Javascript (JS) file that encapsulates all the functionality of CEE. The JS file can be embedded in any application or HTML page. To build a CEE Webcomponent, proceed with these steps: 

### Disable the standalone mode

1. Open the file ```cedar-embeddable-editor/src/app/app.module.ts``` in your favorite editor.
2. Comment out the ```AppComponent``` line:
```typescript
  bootstrap: [
    // TODO: Uncomment this in order to make app runnable alone
    // AppComponent
  ],
```
### Build and copy the Webcomponent JS file

1. Run the build command:
```shell
cedar-embeddable-editor$ ng build --configuration production --output-hashing=none
```
2. Combine the generated files into a single file and copy the final JS to the sample application:
```shell
cedar-embeddable-editor$ cat dist/cedar-embeddable-editor/{runtime,polyfills,main}.js > "/dev/cedar/cedar-cee-demo-generic/assets/js/cedar-embeddable-editor.js"
```

## Configuration

### Configuration file

The CEE configuration file format and storage location depends on the application and the mode in which CEE is being used.

* When running CEE in the standalone mode (developer mode), the configuration parameters are stored in and read from the file: `src/app/app.component.ts`.
* When running CEE as a generic Webcomponent, the configuration parameters can be stored in any `.json` file that is visible to the application that embeds CEE Webcomponent. CEE Webcomponent API provides a method for loading the configuration file from its path at runtime. For example:
```javascript
document.addEventListener('WebComponentsReady', function () {
  const cee = document.querySelector('cedar-embeddable-editor');
  cee.loadConfigFromURL('assets/data/cee-config.json');
});
```
* When using the Angular 2 sample application (https://github.com/metadatacenter/cedar-cee-demo-angular), the configuration is stored in the file: `assets/data/appConfig.json`. 

### Metadata save endpoint

CEE offers the functionality to save user metadata using a custom remote endpoint. If you plan to enable this feature, you will need to set the following configuration:

```json
"showDataSaver": true,
"dataSaverEndpointUrl": "http://localhost:8000/datasave.php",
```
Replace `dataSaverEndpointUrl` with a URL pointing to the endpoint that will handle metadata submissions.

The endpoint can be implemented using any REST-enabled framework/programming language. CEE makes a POST call to the endpoint specified in the configuration file, including the metadata in JSON-LD format in the body of the request.

* Request format:
```json
{
  "metadata": {__contents of meatadata__},
  "info": {__optional info object that can be passed in and out of CEE__}
}
```

CEE allows custom data to be passed to the Webcomponent, which then becomes available to your Metadata save endpoint. The custom data is passed to the Webcomponent via an API call and is propogated to the Metadata save endpoint using the `info` attribute.

Example:

```javascript
function getCustomTemplateInfo() {
  return {
    mycustomtitle: 'ACME Template',
    mycustomurl: 'https://doi.org/10.15468/9vuieb',
    mycutomdataattribute1: 'Hello World',
    mycutomdataattribute2: {name: 'John Doe', age: 35}
  };
}

document.addEventListener('WebComponentsReady', function () {
  const cee = document.querySelector('cedar-embeddable-editor');
  cee.templateInfo = getCustomTemplateInfo();
});
```

When a user pushes the **Save** (metadata) button, these custom attributes are propagated to the Metadata save endpoint.

Example:

```json
{
  "metadata": {__contents of metadata__},
  "info": {
    "mycustomtitle": "ACME Template",
    "mycustomurl": "https://doi.org/10.15468/9vuieb",
    "mycutomdataattribute1": "Hello World",
    "mycutomdataattribute2": {
      "name": "John Doe",
      "age": 35
    }
  }
}
```

If the metadata was created successfully, the response received from the server returns `201 Created` status code.

The response must include a JSON object with the following attributes:
* **id:** identifier of the created resource in the target database.
* **title:** title of the resource that has been created (corresponds to the value of schema:name in the metadata)
* **links:**
  * **self:** If the resource is publicly available, an URL identifying the location of the newly created resource. Otherwise, null.

Example:

```json
{
  "id": "010a261f12b3efc4",
  "title": "single field",
  "links": {
    "self": "http://localhost:8000/metadata/010a261f12b3efc4.json"
  }
}
```

If there was an error,  the corresponding error code and a JSON object with the following attributes:
* **status:** the HTTP status code applicable to this problem, expressed as a string value.
* **title:** a short, human-readable summary of the problem that should not change from occurrence to occurrence of the problem.
* **detail:** a human-readable explanation specific to this occurrence of the problem.

Example:

```json
{
  "status": "500",
  "title": "Internal Error",
  "detail": "Error connecting to database server (invalid credentials)"
}
```

### Template upload endpoint

CEDAR Embeddable Editor includes an optional feature that allows uploading a template source file and creating metadata for that template.

If you plan to enable that functionality, you will need to set up two endpoints in your configuration file:

```json
"showTemplateUpload": true,
"templateUploadBaseUrl": "http://localhost:8000",
"templateUploadEndpoint": "/upload.php",
"templateDownloadEndpoint": "/download.php",
```
Replace `templateUploadBaseUrl` with a URL pointing to the root of the server on which the endpoints reside. Configure `templateUploadEndpoint` and `templateDownloadEndpoint` to their respective paths from the `templateUploadBaseUrl`.

### Required configuration parameters

* **sampleTemplateLocationPrefix:** The base URL that contains the sample CEDAR templates
* **terminologyProxyUrl:** The URL of the proxy endpoint that communicates with BioPortal

```json
{
  "sampleTemplateLocationPrefix": "https://component.metadatacenter.orgx/cedar-embeddable-editor-sample-templates/",
  "terminologyProxyUrl": "https://terminology.metadatacenter.org/bioportal/integrated-search"
}
```

### Optional configuration parameters

The are other optional configuration parameters available for controlling various aspects of the CEE user interface. Most of these are self-explanatory. The example below includes the default values in cases, where the parameter isn't explicitly declared.

```json
{
  "showSampleTemplateLinks": true,
  "loadSampleTemplateName": "19",
  "expandedSampleTemplateLinks": false,
  "showTemplateRenderingRepresentation": true,
  "expandedTemplateRenderingRepresentation": false,
  "showInstanceDataCore": true,
  "expandedInstanceDataCore": true,
  "showInstanceDataFull": false,
  "expandedInstanceDataFull": false,
  "showMultiInstanceInfo": false,
  "expandedMultiInstanceInfo": false,
  "showTemplateSourceData": true,
  "expandedTemplateSourceData": false,
  "showHeader": true,
  "showFooter": true,
  "collapseStaticComponents": true
}
```

## Metadata API

CEE Webcomponent includes APIs for exporting metadata externally and importing metadata into CEE.

### Metadata Export

The metadata currently being edited inside CEE can be exported at anytime by making this call:

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
    console.log(meta);
  }, saveTime);
});
```

### Metadata Import

You can import your metadata into CEE Webcomponent, provided it matches the template currently being edited. To import your metadata, execute this call:

```javascript
cee.metadata = yourCustomMetadataJson
```

In the example below, the metadata is fetched from a remote URL and imported into CEE:

```javascript
function restoreMetadataFromURL(metaUrl, cee, successHandler = null, errorHandler = null) {
  const xhr = new XMLHttpRequest();
  xhr.onreadystatechange = () => {
    if (xhr.readyState === XMLHttpRequest.DONE) {
      if (xhr.status === 200) {
        const jsonMeta = JSON.parse(xhr.responseText);
        cee.metadata = jsonMeta;

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

To reiterate, the metadata being imported **MUST** match the template currently being edited and open in your browser.

## Example Applications

There are two sample applications you can use to demonstrate how to embed and use CEE. Follow the links below to the demo application of your choice. The documentation for each demo application can be found in the README file of the corresponding application.

### CEE Demo Generic

This demo uses a generic HTML page with the CEE Webcomponent embedded in it. It runs standalone, with no dependency on any web framework.

https://github.com/metadatacenter/cedar-cee-demo-generic

### CEE Demo Angular

This demo is written in Angular 2 and requires that framework to run properly.

https://github.com/metadatacenter/cedar-cee-demo-angular
