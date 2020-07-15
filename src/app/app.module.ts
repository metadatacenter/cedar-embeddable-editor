import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import {HttpClient, HttpClientModule} from '@angular/common/http';
import { AppComponent } from './app.component';
import { CedarEmbeddableMetadataEditorComponent } from './modules/shared/components/cedar-embeddable-metadata-editor/cedar-embeddable-metadata-editor.component';
import { DashboardComponent } from './modules/shared/components/dashboard/dashboard.component';
import { RenderTemplateComponent } from './modules/shared/components/render-template/render-template.component';
import {SharedModule} from './modules/shared/shared.module';

@NgModule({
  declarations: [
    AppComponent,
    CedarEmbeddableMetadataEditorComponent,
    DashboardComponent,
    RenderTemplateComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    SharedModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
