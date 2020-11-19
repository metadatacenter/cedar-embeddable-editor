import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RdfPipe} from './pipe/rdf.pipe';
import {CedarComponentHeaderComponent} from './components/cedar-component-header/cedar-component-header.component';
import {MatCardModule} from '@angular/material/card';
import {MatIconModule} from '@angular/material/icon';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {MatFormFieldModule} from '@angular/material/form-field';
import {ReactiveFormsModule} from '@angular/forms';
import {MatInputModule} from '@angular/material/input';
import {MatExpansionModule} from '@angular/material/expansion';
import {MatButtonModule} from '@angular/material/button';
import {MatTooltipModule} from '@angular/material/tooltip';
import {ClipboardModule} from '@angular/cdk/clipboard';
import {MatToolbarModule} from '@angular/material/toolbar';
import {MatRippleModule} from '@angular/material/core';
import {MatPaginatorModule} from '@angular/material/paginator';
import {MatChipsModule} from '@angular/material/chips';
import {MatGridListModule} from '@angular/material/grid-list';
import {CedarEmbeddableMetadataEditorComponent} from './components/cedar-embeddable-metadata-editor/cedar-embeddable-metadata-editor.component';
import {DashboardComponent} from './components/dashboard/dashboard.component';
import {CedarComponentRendererComponent} from './components/cedar-component-renderer/cedar-component-renderer.component';
import {StaticFooterComponent} from './components/static-footer/static-footer.component';
import {StaticHeaderComponent} from './components/static-header/static-header.component';
import {SourcePanelsComponent} from './components/source-panels/source-panels.component';
import {CedarMultiPagerComponent} from './components/cedar-multi-pager/cedar-multi-pager.component';
import {InputTypesModule} from '../input-types/input-types.module';
import {CedarEmbeddableMetadataEditorWrapperComponent} from './components/cedar-embeddable-metadata-editor-wrapper/cedar-embeddable-metadata-editor-wrapper.component';


@NgModule({
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    BrowserAnimationsModule,
    MatFormFieldModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatExpansionModule,
    MatButtonModule,
    MatTooltipModule,
    ClipboardModule,
    MatToolbarModule,
    MatRippleModule,
    MatPaginatorModule,
    MatChipsModule,
    MatGridListModule,
    InputTypesModule
  ],
  declarations: [
    RdfPipe,
    CedarComponentHeaderComponent,
    CedarEmbeddableMetadataEditorComponent,
    CedarEmbeddableMetadataEditorWrapperComponent,
    DashboardComponent,
    CedarComponentRendererComponent,
    StaticFooterComponent,
    StaticHeaderComponent,
    SourcePanelsComponent,
    CedarMultiPagerComponent
  ],
  providers: [],
  exports: [
    RdfPipe,
    CedarEmbeddableMetadataEditorWrapperComponent,
  ]
})
export class SharedModule {
}
