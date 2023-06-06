import {BrowserModule} from '@angular/platform-browser';
import {Injector, NgModule} from '@angular/core';
import {createCustomElement} from '@angular/elements';
import {HttpClientModule} from '@angular/common/http';
import {AppComponentDev} from './app.component.dev';
import {SharedModule} from './modules/shared/shared.module';
import {JsonPipe} from '@angular/common';
import {InputTypesModule} from './modules/input-types/input-types.module';
import {
  CedarEmbeddableMetadataEditorWrapperComponent
} from './modules/shared/components/cedar-embeddable-metadata-editor-wrapper/cedar-embeddable-metadata-editor-wrapper.component';

@NgModule({
  declarations: [
    AppComponentDev
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    SharedModule,
    InputTypesModule
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
