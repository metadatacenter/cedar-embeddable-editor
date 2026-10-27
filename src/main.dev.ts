import { provideZoneChangeDetection } from '@angular/core';
import { platformBrowser } from '@angular/platform-browser';
import { AppModuleDev } from './app/app.module.dev';
import { version } from 'package.json';
import { CedarEditorBootstrapState } from './app/bootstrap-once';

/**
 * Bootstrap the standalone developer app, which hosts CEE the way an embedding page does.
 *
 * `ng serve` and the default build start here. The production build starts at `main.ts`, so
 * nothing this app imports reaches the published bundle.
 */
(window as Window & CedarEditorBootstrapState).cedarEmbeddableEditorVersion = version;
platformBrowser()
  .bootstrapModule(AppModuleDev, { applicationProviders: [provideZoneChangeDetection()] })
  .catch((err) => console.error(err));
