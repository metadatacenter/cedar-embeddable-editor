import {BrowserModule} from '@angular/platform-browser';
import {Injector, NgModule} from '@angular/core';
import {createCustomElement} from '@angular/elements';
import {HttpClient, HttpClientModule} from '@angular/common/http';
import {AppComponentDev} from './app.component.dev';
import {SharedModule} from './modules/shared/shared.module';
import {JsonPipe} from '@angular/common';
import {InputTypesModule} from './modules/input-types/input-types.module';
import {
  CedarEmbeddableMetadataEditorWrapperComponent
} from './modules/shared/components/cedar-embeddable-metadata-editor-wrapper/cedar-embeddable-metadata-editor-wrapper.component';
import {TranslateHttpLoader} from '@ngx-translate/http-loader';
import {TranslateLoader, TranslateModule} from '@ngx-translate/core';
import * as fallbackMapEN from '../../src/assets/i18n-cee/en.json';
import * as fallbackMapHU from '../../src/assets/i18n-cee/hu.json';
import {Observable} from 'rxjs';
import {catchError} from 'rxjs/operators';

export class FallbackTranslateLoader implements TranslateLoader {
  constructor(private http: HttpClient, private fallback: object) {
  }

  getTranslation(lang: string): Observable<any> {
    console.log('GET translation:' + lang);
    const httpLoader = new TranslateHttpLoader(this.http, '/assets/i18n-cee/');

    return httpLoader.getTranslation(lang).pipe(
        catchError(err => {
          console.log('Translation file not found, using built-in version', err);
          if (this.fallback.hasOwnProperty(lang)) {
            return Promise.resolve(this.fallback[lang]);
          } else {
            return Promise.resolve(null);
          }
        })
    );
  }
}

export function FallbackTranslateLoaderFactory(http: HttpClient, fallback: any): TranslateLoader {
  return new FallbackTranslateLoader(http, fallback);
}

@NgModule({
  declarations: [
    AppComponentDev
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    SharedModule,
    InputTypesModule,
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: (http: HttpClient) => FallbackTranslateLoaderFactory(http,
            {
              en: fallbackMapEN,
              hu: fallbackMapHU
            }),
        deps: [HttpClient]
      }
    }),
  ],
  providers: [
    JsonPipe
  ],
  bootstrap: [
    AppComponentDev
  ],
  exports: [],
  entryComponents: [
    CedarEmbeddableMetadataEditorWrapperComponent
  ]
})
export class AppModuleDev {

  constructor(private injector: Injector) {
  }

  ngDoBootstrap(): void {
    const cedarCustomElement = createCustomElement(CedarEmbeddableMetadataEditorWrapperComponent, {
      injector: this.injector
    });
    customElements.define('cedar-embeddable-editor', cedarCustomElement);
  }
}
