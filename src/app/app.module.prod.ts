import { BrowserModule } from '@angular/platform-browser';
import { DoBootstrap, Injector, NgModule } from '@angular/core';
import { createCustomElement } from '@angular/elements';
import { HttpClient, provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { AppProdComponent } from './app.component.prod';
import { SharedModule } from './modules/shared/shared.module';
import { JsonPipe } from '@angular/common';
import { CedarEmbeddableMetadataEditorWrapperComponent } from './modules/shared/components/cedar-embeddable-metadata-editor-wrapper/cedar-embeddable-metadata-editor-wrapper.component';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import * as fallbackMapEN from '../assets/i18n-cee/en.json';
import * as fallbackMapHU from '../assets/i18n-cee/hu.json';
import { MessageHandlerService } from './modules/shared/service/message-handler.service';
import { FallbackTranslateLoaderFactory } from './modules/shared/util/fallback-translate-loader-factory';
import { GlobalSettingsContextService } from './modules/shared/service/global-settings-context.service';
import { defineCustomElementOnce } from './custom-element';

@NgModule({
  declarations: [AppProdComponent],
  bootstrap: [],
  exports: [],
  imports: [
    BrowserModule,
    SharedModule,
    TranslateModule.forRoot({
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
  providers: [JsonPipe, provideHttpClient(withXhr(), withInterceptorsFromDi())],
})
export class AppModuleProd implements DoBootstrap {
  constructor(private injector: Injector) {}

  ngDoBootstrap(): void {
    defineCustomElementOnce(() =>
      createCustomElement(CedarEmbeddableMetadataEditorWrapperComponent, {
        injector: this.injector,
      }),
    );
  }
}
