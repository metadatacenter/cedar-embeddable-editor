import {BrowserModule} from '@angular/platform-browser';
import {Injector, NgModule} from '@angular/core';
import {createCustomElement} from '@angular/elements';
import {HttpClientModule} from '@angular/common/http';
import {AppComponent} from './app.component';
import {SharedModule} from './modules/shared/shared.module';
import {JsonPipe} from '@angular/common';
import {InputTypesModule} from './modules/input-types/input-types.module';
import {ElementZoneStrategyFactory} from 'elements-zone-strategy';
import {CedarEmbeddableMetadataEditorWrapperComponent} from './modules/shared/components/cedar-embeddable-metadata-editor-wrapper/cedar-embeddable-metadata-editor-wrapper.component';

@NgModule({
  declarations: [
    AppComponent,
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
    // TODO: Uncomment this in order to make app runnable alone
    // AppComponent
  ],
  entryComponents: []
})
export class AppModule {

  constructor(private injector: Injector) {
  }

  ngDoBootstrap(): void {
    const {injector} = this;
    const strategyFactory = new ElementZoneStrategyFactory(CedarEmbeddableMetadataEditorWrapperComponent, this.injector);
    const ngCedarCustomElement = createCustomElement(CedarEmbeddableMetadataEditorWrapperComponent, {
      injector: this.injector,
      strategyFactory
    });
    customElements.define('cedar-embeddable-editor', ngCedarCustomElement);
  }
}
