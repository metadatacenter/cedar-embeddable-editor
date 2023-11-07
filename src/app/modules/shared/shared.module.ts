import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RdfPipe } from './pipe/rdf.pipe';
import { CedarComponentHeaderComponent } from './components/cedar-component-header/cedar-component-header.component';
import { MatLegacyCardModule as MatCardModule } from '@angular/material/legacy-card';
import { MatIconModule } from '@angular/material/icon';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatLegacyFormFieldModule as MatFormFieldModule } from '@angular/material/legacy-form-field';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatLegacyInputModule as MatInputModule } from '@angular/material/legacy-input';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatLegacyButtonModule as MatButtonModule } from '@angular/material/legacy-button';
import { MatLegacyTooltipModule as MatTooltipModule } from '@angular/material/legacy-tooltip';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatRippleModule } from '@angular/material/core';
import { MatLegacyPaginatorModule as MatPaginatorModule } from '@angular/material/legacy-paginator';
import { MatLegacyChipsModule as MatChipsModule } from '@angular/material/legacy-chips';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatLegacyProgressSpinnerModule as MatProgressSpinnerModule } from '@angular/material/legacy-progress-spinner';
import { MatLegacyListModule as MatListModule } from '@angular/material/legacy-list';
import { MatLegacySelectModule as MatSelectModule } from '@angular/material/legacy-select';
import { NgxMatSelectSearchModule } from 'ngx-mat-select-search';
import { NgSelectModule } from '@ng-select/ng-select';
import { CedarEmbeddableMetadataEditorComponent } from './components/cedar-embeddable-metadata-editor/cedar-embeddable-metadata-editor.component';
import { CedarComponentRendererComponent } from './components/cedar-component-renderer/cedar-component-renderer.component';
import { StaticFooterComponent } from './components/static-footer/static-footer.component';
import { StaticHeaderComponent } from './components/static-header/static-header.component';
import { SourcePanelsComponent } from './components/source-panels/source-panels.component';
import { CedarMultiPagerComponent } from './components/cedar-multi-pager/cedar-multi-pager.component';
import { InputTypesModule } from '../input-types/input-types.module';
import { CedarEmbeddableMetadataEditorWrapperComponent } from './components/cedar-embeddable-metadata-editor-wrapper/cedar-embeddable-metadata-editor-wrapper.component';
import { SampleTemplatesComponent } from './components/sample-templates/sample-templates.component';
import { SampleTemplateSelectComponent } from './components/sample-template-select/sample-template-select.component';
import { PreferencesMenu } from './components/preferences-menu/preferences-menu.component';
import { MatLegacyMenuModule as MatMenuModule } from '@angular/material/legacy-menu';
import { MatLegacySlideToggleModule as MatSlideToggleModule } from '@angular/material/legacy-slide-toggle';
import { TranslateModule } from '@ngx-translate/core';
import { MatLegacyCheckboxModule as MatCheckboxModule } from '@angular/material/legacy-checkbox';

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
    MatProgressSpinnerModule,
    MatListModule,
    MatSelectModule,
    NgxMatSelectSearchModule,
    NgSelectModule,
    InputTypesModule,
    FormsModule,
    MatMenuModule,
    MatSlideToggleModule,
    TranslateModule,
    MatCheckboxModule,
  ],
  declarations: [
    RdfPipe,
    CedarComponentHeaderComponent,
    CedarEmbeddableMetadataEditorComponent,
    CedarEmbeddableMetadataEditorWrapperComponent,
    SampleTemplatesComponent,
    SampleTemplateSelectComponent,
    CedarComponentRendererComponent,
    StaticFooterComponent,
    StaticHeaderComponent,
    SourcePanelsComponent,
    CedarMultiPagerComponent,
    PreferencesMenu,
  ],
  providers: [],
  exports: [RdfPipe, CedarEmbeddableMetadataEditorWrapperComponent],
})
export class SharedModule {}
