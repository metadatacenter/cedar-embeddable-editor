import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatMenuModule } from '@angular/material/menu';
import { RdfPipe } from './pipe/rdf.pipe';
import { CedarComponentHeaderComponent } from './components/cedar-component-header/cedar-component-header.component';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatRippleModule } from '@angular/material/core';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatChipsModule } from '@angular/material/chips';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatListModule } from '@angular/material/list';
import { MatSelectModule } from '@angular/material/select';
import { CedarEmbeddableMetadataEditorComponent } from './components/cedar-embeddable-metadata-editor/cedar-embeddable-metadata-editor.component';
import { CedarComponentRendererComponent } from './components/cedar-component-renderer/cedar-component-renderer.component';
import { StaticFooterComponent } from './components/static-footer/static-footer.component';
import { StaticHeaderComponent } from './components/static-header/static-header.component';
import { DownloadMenuComponent } from './components/download-menu/download-menu.component';
import { CedarMultiPagerComponent } from './components/cedar-multi-pager/cedar-multi-pager.component';
import { InputTypesModule } from '../input-types/input-types.module';
import { CedarEmbeddableMetadataEditorWrapperComponent } from './components/cedar-embeddable-metadata-editor-wrapper/cedar-embeddable-metadata-editor-wrapper.component';
import { TranslateModule } from '@ngx-translate/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { CedarFontRegistrarComponent } from './components/cedar-font-registrar/cedar-font-registrar.component';

@NgModule({
  imports: [
    CommonModule,
    MatMenuModule,
    MatCardModule,
    MatIconModule,
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
    MatListModule,
    MatSelectModule,
    InputTypesModule,
    FormsModule,
    TranslateModule,
    MatCheckboxModule,
  ],
  declarations: [
    RdfPipe,
    CedarComponentHeaderComponent,
    CedarEmbeddableMetadataEditorComponent,
    CedarEmbeddableMetadataEditorWrapperComponent,
    CedarFontRegistrarComponent,
    CedarComponentRendererComponent,
    StaticFooterComponent,
    StaticHeaderComponent,
    DownloadMenuComponent,
    CedarMultiPagerComponent,
  ],
  providers: [],
  exports: [RdfPipe, CedarEmbeddableMetadataEditorWrapperComponent],
})
export class SharedModule {}
