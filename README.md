# Cedar Embeddable Editor (CEE)

The CEDAR Embeddable Editor is as a web component that implements the functionality of the CEDAR Metadata Editor.

It takes CEDAR JSON-LD templates as input, and produces CEDAR JSON-LD metadata.

## Running as a standalone application

To run CEE in the standalone mode (NOT as a webcomponent), proceed with the following steps:

### Clone the repository

1. Clone this repository onto a local directory of your choice

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
2. Edit configuration parameters based on your local environment (see section Configuration for details).

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

## Building the Webcomponent

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

## Example Applications

There are two sample applications you can use to demonstrate how to embed and use CEE. Follow the links below to the demo application of your choice. The documentation for each demo application can be found in the README file of the corresponding application.

### CEE Demo Generic

This demo uses a generic HTML page with the CEE Webcomponent embedded in it. It runs standalone, with no dependency on any web framework.

https://github.com/metadatacenter/cedar-cee-demo-generic

### CEE Demo Angular

This demo is written in Angular 2 and requires that framework to run properly.

https://github.com/metadatacenter/cedar-cee-demo-angular
