import {BrowserModule} from '@angular/platform-browser';
import {Injector, NgModule} from '@angular/core';
import {createCustomElement} from '@angular/elements';
import {HttpClient, HttpClientModule} from '@angular/common/http';
import {AppComponentProd} from './app.component.prod';
import {SharedModule} from './modules/shared/shared.module';
import {JsonPipe} from '@angular/common';
import {InputTypesModule} from './modules/input-types/input-types.module';
import {
    CedarEmbeddableMetadataEditorWrapperComponent
} from './modules/shared/components/cedar-embeddable-metadata-editor-wrapper/cedar-embeddable-metadata-editor-wrapper.component';
import {TranslateHttpLoader} from '@ngx-translate/http-loader';
import {TranslateLoader, TranslateModule} from '@ngx-translate/core';

export function HttpLoaderFactory(http: HttpClient): TranslateHttpLoader {
  return new TranslateHttpLoader(http, '/assets/i18n-cee/');
}

@NgModule({
    declarations: [
        AppComponentProd
    ],
    imports: [
        BrowserModule,
        HttpClientModule,
        SharedModule,
        InputTypesModule,
        TranslateModule.forRoot({
            loader: {
                provide: TranslateLoader,
                useFactory: HttpLoaderFactory,
                deps: [HttpClient]
            }
        }),
    ],
    providers: [
        JsonPipe
    ],
    bootstrap: [],
    exports: [],
    entryComponents: [
        CedarEmbeddableMetadataEditorWrapperComponent
    ]
})
export class AppModuleProd {

    constructor(private injector: Injector) {
    }

    ngDoBootstrap(): void {
        const cedarCustomElement = createCustomElement(CedarEmbeddableMetadataEditorWrapperComponent, {
            injector: this.injector
        });
        customElements.define('cedar-embeddable-editor', cedarCustomElement);
    }
}
