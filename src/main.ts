import { enableProdMode, provideZoneChangeDetection } from '@angular/core';
import { platformBrowser } from '@angular/platform-browser';
import { environment } from './environments/environment';
import { AppModuleProd } from './app/app.module.prod';
import { AppModuleDev } from './app/app.module.dev';
import packageJson from 'package.json';
import { bootstrapCedarEditorOnce, CedarEditorBootstrapState } from './app/bootstrap-once';

// needed for jsonld js library
// (window as any).global = window;

if (environment.production) {
  enableProdMode();
}

if (environment.production) {
  bootstrapCedarEditorOnce(
    window as Window & CedarEditorBootstrapState,
    () => {
      // Assign the version only to the bundle that wins the bootstrap slot. If
      // another version is loaded later, it must not claim to be the one running.
      (window as Window & CedarEditorBootstrapState).cedarEmbeddableEditorVersion = packageJson.version;
      return platformBrowser().bootstrapModule(AppModuleProd, {
        applicationProviders: [provideZoneChangeDetection()],
      });
    },
    (err) => console.error(err),
  );
} else {
  (window as Window & CedarEditorBootstrapState).cedarEmbeddableEditorVersion = packageJson.version;
  platformBrowser()
    .bootstrapModule(AppModuleDev, { applicationProviders: [provideZoneChangeDetection()] })
    .catch((err) => console.error(err));
}
