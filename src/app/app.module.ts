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
import {CedarComponentRendererComponent} from './modules/shared/components/cedar-component-renderer/cedar-component-renderer.component';
import {CedarInputNumericComponent} from './modules/shared/components/cedar-input-numeric/cedar-input-numeric.component';
import {ReactiveFormsModule} from '@angular/forms';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatIconModule} from '@angular/material/icon';
import {MatExpansionModule} from '@angular/material/expansion';
import {MatButtonModule} from '@angular/material/button';
import {MatTooltipModule} from '@angular/material/tooltip';
import {MatToolbarModule} from '@angular/material/toolbar';
import {MatPaginatorModule} from '@angular/material/paginator';
import {MatChipsModule} from '@angular/material/chips';
import {MatGridListModule} from '@angular/material/grid-list';
import {MatRippleModule} from '@angular/material/core';
import {ClipboardModule} from '@angular/cdk/clipboard';
import {JsonPipe} from '@angular/common';
import { CedarInputTextfieldComponent } from './modules/shared/components/cedar-input-textfield/cedar-input-textfield.component';
import { StaticFooterComponent } from './modules/shared/components/static-footer/static-footer.component';
import { StaticHeaderComponent } from './modules/shared/components/static-header/static-header.component';
import { SourcePanelsComponent } from './modules/shared/components/source-panels/source-panels.component';
import { CedarMultiPagerComponent } from './modules/shared/components/cedar-multi-pager/cedar-multi-pager.component';

@NgModule({
  declarations: [
    AppComponent,
    CedarEmbeddableMetadataEditorComponent,
    DashboardComponent,
    RenderTemplateComponent,
    CedarComponentRendererComponent,
    CedarInputNumericComponent,
    CedarInputTextfieldComponent,
    StaticFooterComponent,
    StaticHeaderComponent,
    SourcePanelsComponent,
    CedarMultiPagerComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    SharedModule,
    BrowserAnimationsModule,
    MatCardModule,
    MatFormFieldModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatExpansionModule,
    MatButtonModule,
    MatTooltipModule,
    ClipboardModule,
    MatToolbarModule,
    MatRippleModule,
    MatPaginatorModule,
    MatChipsModule,
    MatGridListModule
  ],
  providers: [JsonPipe],
  bootstrap: [AppComponent]
})
export class AppModule {
}
