import { enableProdMode, provideZoneChangeDetection } from '@angular/core';
import { platformBrowser } from '@angular/platform-browser';
import { environment } from './environments/environment';
import { AppModuleProd } from './app/app.module.prod';
import { version } from 'package.json';
import { bootstrapCedarEditorOnce, CedarEditorBootstrapState } from './app/bootstrap-once';

/**
 * Register CEE's custom elements, and nothing else.
 *
 * The production build starts here. `ng serve` and the default build start at `main.dev.ts`, which
 * bootstraps the standalone developer app. This entry used to bootstrap either module behind
 * `environment.production`. Because esbuild does not fold a property read across modules into a
 * constant, the unreachable developer app and the Material theme its stylesheet imports stayed in
 * every production bundle.
 */

// needed for jsonld js library
// (window as any).global = window;

if (environment.production) {
  enableProdMode();
}

bootstrapCedarEditorOnce(
  window as Window & CedarEditorBootstrapState,
  () => {
    // Assign the version only to the bundle that wins the bootstrap slot. If
    // another version is loaded later, it must not claim to be the one running.
    (window as Window & CedarEditorBootstrapState).cedarEmbeddableEditorVersion = version;
    return platformBrowser().bootstrapModule(AppModuleProd, {
      applicationProviders: [provideZoneChangeDetection()],
    });
  },
  (err) => console.error(err),
);
