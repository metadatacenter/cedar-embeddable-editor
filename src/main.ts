import {enableProdMode} from '@angular/core';
import {platformBrowserDynamic} from '@angular/platform-browser-dynamic';
import {environment} from './environments/environment';
import {AppModuleProd} from './app/app.module.prod';
import {AppModuleDev} from './app/app.module.dev';

declare global {
  interface Window {
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
  platformBrowserDynamic().bootstrapModule(AppModuleProd)
    .catch(err => console.error(err));
} else {
  platformBrowserDynamic().bootstrapModule(AppModuleDev)
    .catch(err => console.error(err));
}
