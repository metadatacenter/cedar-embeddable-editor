import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { environment } from './environments/environment';
import { AppModuleProd } from './app/app.module.prod';
import { AppModuleDev } from './app/app.module.dev';
import packageJson from 'package.json';
import { bootstrapCedarEditorOnce, CedarEditorBootstrapState } from './app/bootstrap-once';

declare global {
  interface Window extends CedarEditorBootstrapState {
    WebComponents: {
      ready: boolean;
    };
  }
}

// needed for jsonld js library
// (window as any).global = window;

if (environment.production) {
  enableProdMode();
}

if (environment.production) {
  bootstrapCedarEditorOnce(
    window,
    () => {
      // Assign the version only to the bundle that wins the bootstrap slot. If
      // another version is loaded later, it must not claim to be the one running.
      (window as any).cedarEmbeddableEditorVersion = packageJson.version;
      return platformBrowserDynamic().bootstrapModule(AppModuleProd);
    },
    (err) => console.error(err),
  );
} else {
  (window as any).cedarEmbeddableEditorVersion = packageJson.version;
  platformBrowserDynamic()
    .bootstrapModule(AppModuleDev)
    .catch((err) => console.error(err));
}
