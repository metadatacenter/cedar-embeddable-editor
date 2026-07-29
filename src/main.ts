import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { environment } from './environments/environment';
import { AppModuleProd } from './app/app.module.prod';
import { AppModuleDev } from './app/app.module.dev';
import packageJson from 'package.json';

declare global {
  interface Window {
    WebComponents: {
      ready: boolean;
    };
  }
}

// Expose the loaded CEE bundle version as a global, so host apps (e.g. the CEDAR
// template-editor settings page) can display which CEE is actually running — a
// stale cached bundle then shows the old version, which is the point.
(window as any).cedarEmbeddableEditorVersion = packageJson.version;

// needed for jsonld js library
// (window as any).global = window;

if (environment.production) {
  enableProdMode();
}

if (environment.production) {
  platformBrowserDynamic()
    .bootstrapModule(AppModuleProd)
    .catch((err) => console.error(err));
} else {
  platformBrowserDynamic()
    .bootstrapModule(AppModuleDev)
    .catch((err) => console.error(err));
}
