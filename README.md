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


## Example Applications





Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory. Use the `--prod` flag for a production build.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via [Protractor](http://www.protractortest.org/).

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI README](https://github.com/angular/angular-cli/blob/master/README.md).
