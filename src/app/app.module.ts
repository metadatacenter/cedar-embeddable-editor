import {BrowserModule} from '@angular/platform-browser';
import {NgModule} from '@angular/core';

import {AppRoutingModule} from './app-routing.module';
import {HttpClientModule} from '@angular/common/http';
import {AppComponent} from './app.component';
import {CedarEmbeddableMetadataEditorComponent} from './modules/shared/components/cedar-embeddable-metadata-editor/cedar-embeddable-metadata-editor.component';
import {DashboardComponent} from './modules/shared/components/dashboard/dashboard.component';
import {RenderTemplateComponent} from './modules/shared/components/render-template/render-template.component';
import {SharedModule} from './modules/shared/shared.module';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {MatCardModule} from '@angular/material/card';
import {MatFormFieldModule} from '@angular/material/form-field';
import {CedarComponentRendererComponent} from './modules/shared/components/cedar-component-renderer/cedar-component-renderer.component';
import {CedarInputNumericComponent} from './modules/shared/components/cedar-input-numeric/cedar-input-numeric.component';
import {ReactiveFormsModule} from '@angular/forms';

@NgModule({
  declarations: [
    AppComponent,
    CedarEmbeddableMetadataEditorComponent,
    DashboardComponent,
    RenderTemplateComponent,
    CedarComponentRendererComponent,
    CedarInputNumericComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    SharedModule,
    BrowserAnimationsModule,
    MatCardModule,
    MatFormFieldModule,
    ReactiveFormsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {
}
