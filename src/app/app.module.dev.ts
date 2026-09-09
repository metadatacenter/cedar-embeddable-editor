import { BrowserModule } from '@angular/platform-browser';
import { DoBootstrap, Injector, NgModule } from '@angular/core';
import { createCustomElement } from '@angular/elements';
import { HttpClient, provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { AppDevComponent } from './app.component.dev';
import { SharedModule } from './modules/shared/shared.module';
import { JsonPipe } from '@angular/common';
import { CedarEmbeddableMetadataEditorWrapperComponent } from './modules/shared/components/cedar-embeddable-metadata-editor-wrapper/cedar-embeddable-metadata-editor-wrapper.component';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import * as fallbackMapEN from '../assets/i18n-cee/en.json';
import * as fallbackMapHU from '../assets/i18n-cee/hu.json';
import { MessageHandlerService } from './modules/shared/service/message-handler.service';
import { FallbackTranslateLoaderFactory } from './modules/shared/util/fallback-translate-loader-factory';
import { GlobalSettingsContextService } from './modules/shared/service/global-settings-context.service';
import {
  CEDAR_CUSTOM_ELEMENT_NAME,
  CEDAR_EMBEDDABLE_FIELD_CUSTOM_ELEMENT_NAME,
  defineCustomElementOnce,
} from './custom-element';
import { CedarEmbeddableFieldWrapperComponent } from './modules/shared/components/cedar-embeddable-field-wrapper/cedar-embeddable-field-wrapper.component';

@NgModule({
  declarations: [AppDevComponent],
  bootstrap: [AppDevComponent],
  exports: [],
  imports: [BrowserModule, SharedModule],
  providers: [
    JsonPipe,
    provideHttpClient(withXhr(), withInterceptorsFromDi()),
    provideTranslateService({
      loader: {
        provide: TranslateLoader,
        useFactory: (
          http: HttpClient,
          messageHandlerService: MessageHandlerService,
          globalSettingsContextService: GlobalSettingsContextService,
        ) =>
          FallbackTranslateLoaderFactory(http, messageHandlerService, globalSettingsContextService, {
            en: fallbackMapEN,
            hu: fallbackMapHU,
          }),
        deps: [HttpClient, MessageHandlerService, GlobalSettingsContextService],
      },
    }),
  ],
})
export class AppModuleDev implements DoBootstrap {
  constructor(private injector: Injector) {}

  ngDoBootstrap(): void {
    defineCustomElementOnce(CEDAR_CUSTOM_ELEMENT_NAME, () =>
      createCustomElement(CedarEmbeddableMetadataEditorWrapperComponent, {
        injector: this.injector,
      }),
    );
    defineCustomElementOnce(CEDAR_EMBEDDABLE_FIELD_CUSTOM_ELEMENT_NAME, () =>
      createCustomElement(CedarEmbeddableFieldWrapperComponent, {
        injector: this.injector,
      }),
    );
  }
}
