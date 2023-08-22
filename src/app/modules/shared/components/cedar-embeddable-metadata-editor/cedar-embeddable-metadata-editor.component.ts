import {Component, EventEmitter, Input, OnInit, Output, ViewEncapsulation} from '@angular/core';
import {NullTemplate} from '../../models/template/null-template.model';
import {DataContext} from '../../util/data-context';
import {HandlerContext} from '../../util/handler-context';
import {PageBreakPaginatorService} from '../../service/page-break-paginator.service';


@Component({
  selector: 'app-cedar-embeddable-metadata-editor',
  templateUrl: './cedar-embeddable-metadata-editor.component.html',
  styleUrls: ['./cedar-embeddable-metadata-editor.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class CedarEmbeddableMetadataEditorComponent implements OnInit {
  private static SHOW_TEMPLATE_RENDERING = 'showTemplateRenderingRepresentation';
  private static SHOW_MULTI_INSTANCE = 'showMultiInstanceInfo';
  private static SHOW_TEMPLATE_SOURCE = 'showTemplateSourceData';
  private static SHOW_INSTANCE_CORE = 'showInstanceDataCore';
  private static SHOW_INSTANCE_FULL = 'showInstanceDataFull';
  private static SHOW_SAMPLE_TEMPLATE_LINKS = 'showSampleTemplateLinks';

  private static SHOW_HEADER = 'showHeader';
  private static SHOW_FOOTER = 'showFooter';

  private static EXPANDED_TEMPLATE_RENDERING = 'expandedTemplateRenderingRepresentation';
  private static EXPANDED_MULTI_INSTANCE = 'expandedMultiInstanceInfo';
  private static EXPANDED_TEMPLATE_SOURCE = 'expandedTemplateSourceData';
  private static EXPANDED_INSTANCE_CORE = 'expandedInstanceDataCore';
  private static EXPANDED_INSTANCE_FULL = 'expandedInstanceDataFull';
  private static EXPANDED_SAMPLE_TEMPLATE_LINKS = 'expandedSampleTemplateLinks';

  private static COLLAPSE_STATIC_COMPONENTS = 'collapseStaticComponents';

  private static SHOW_STATIC_TEXT = 'showStaticText';

  private readonly dataContext: DataContext = null;

  private readonly handlerContext: HandlerContext = null;
  @Output() handlerContextEvent = new EventEmitter<HandlerContext>();

  private readonly pageBreakPaginatorService: PageBreakPaginatorService = null;

  @Input() sampleTemplateLoaderObject: any = null;

  showTemplateRenderingRepresentation = false;
  showMultiInstanceInfo = false;
  showTemplateSourceData = true;
  showInstanceDataCore = false;
  showInstanceDataFull = true;
  showSampleTemplateLinks = false;
  showStaticText = false;

  showHeader = false;
  showFooter = false;

  expandedTemplateRenderingRepresentation = false;
  expandedMultiInstanceInfo = false;
  expandedTemplateSourceData = false;
  expandedInstanceDataCore = false;
  expandedInstanceDataFull = false;
  expandedSampleTemplateLinks = false;

  collapseStaticComponents = true;

  allExpanded: boolean;

  constructor() {
    this.pageBreakPaginatorService = new PageBreakPaginatorService();
    this.dataContext = new DataContext();
    this.handlerContext = new HandlerContext(this.dataContext);
  }

  ngOnInit(): void {
  }

  @Input() set config(value: object) {
    if (value != null) {
      if (value.hasOwnProperty(CedarEmbeddableMetadataEditorComponent.SHOW_TEMPLATE_RENDERING)) {
        this.showTemplateRenderingRepresentation = value[CedarEmbeddableMetadataEditorComponent.SHOW_TEMPLATE_RENDERING];
      }
      if (value.hasOwnProperty(CedarEmbeddableMetadataEditorComponent.SHOW_MULTI_INSTANCE)) {
        this.showMultiInstanceInfo = value[CedarEmbeddableMetadataEditorComponent.SHOW_MULTI_INSTANCE];
      }
      if (value.hasOwnProperty(CedarEmbeddableMetadataEditorComponent.SHOW_TEMPLATE_SOURCE)) {
        this.showTemplateSourceData = value[CedarEmbeddableMetadataEditorComponent.SHOW_TEMPLATE_SOURCE];
      }
      if (value.hasOwnProperty(CedarEmbeddableMetadataEditorComponent.SHOW_INSTANCE_CORE)) {
        this.showInstanceDataCore = value[CedarEmbeddableMetadataEditorComponent.SHOW_INSTANCE_CORE];
      }
      if (value.hasOwnProperty(CedarEmbeddableMetadataEditorComponent.SHOW_INSTANCE_FULL)) {
        this.showInstanceDataFull = value[CedarEmbeddableMetadataEditorComponent.SHOW_INSTANCE_FULL];
      }
      if (value.hasOwnProperty(CedarEmbeddableMetadataEditorComponent.SHOW_SAMPLE_TEMPLATE_LINKS)) {
        this.showSampleTemplateLinks = value[CedarEmbeddableMetadataEditorComponent.SHOW_SAMPLE_TEMPLATE_LINKS];
      }
      if (value.hasOwnProperty(CedarEmbeddableMetadataEditorComponent.SHOW_FOOTER)) {
        this.showFooter = value[CedarEmbeddableMetadataEditorComponent.SHOW_FOOTER];
      }
      if (value.hasOwnProperty(CedarEmbeddableMetadataEditorComponent.SHOW_HEADER)) {
        this.showHeader = value[CedarEmbeddableMetadataEditorComponent.SHOW_HEADER];
      }
      if (value.hasOwnProperty(CedarEmbeddableMetadataEditorComponent.EXPANDED_TEMPLATE_RENDERING)) {
        this.expandedTemplateRenderingRepresentation = value[CedarEmbeddableMetadataEditorComponent.EXPANDED_TEMPLATE_RENDERING];
      }
      if (value.hasOwnProperty(CedarEmbeddableMetadataEditorComponent.EXPANDED_MULTI_INSTANCE)) {
        this.expandedMultiInstanceInfo = value[CedarEmbeddableMetadataEditorComponent.EXPANDED_MULTI_INSTANCE];
      }
      if (value.hasOwnProperty(CedarEmbeddableMetadataEditorComponent.EXPANDED_TEMPLATE_SOURCE)) {
        this.expandedTemplateSourceData = value[CedarEmbeddableMetadataEditorComponent.EXPANDED_TEMPLATE_SOURCE];
      }
      if (value.hasOwnProperty(CedarEmbeddableMetadataEditorComponent.EXPANDED_INSTANCE_CORE)) {
        this.expandedInstanceDataCore = value[CedarEmbeddableMetadataEditorComponent.EXPANDED_INSTANCE_CORE];
      }
      if (value.hasOwnProperty(CedarEmbeddableMetadataEditorComponent.EXPANDED_INSTANCE_FULL)) {
        this.expandedInstanceDataFull = value[CedarEmbeddableMetadataEditorComponent.EXPANDED_INSTANCE_FULL];
      }
      if (value.hasOwnProperty(CedarEmbeddableMetadataEditorComponent.EXPANDED_SAMPLE_TEMPLATE_LINKS)) {
        this.expandedSampleTemplateLinks = value[CedarEmbeddableMetadataEditorComponent.EXPANDED_SAMPLE_TEMPLATE_LINKS];
      }
      if (value.hasOwnProperty(CedarEmbeddableMetadataEditorComponent.COLLAPSE_STATIC_COMPONENTS)) {
        this.collapseStaticComponents = value[CedarEmbeddableMetadataEditorComponent.COLLAPSE_STATIC_COMPONENTS];
      }
      if (value.hasOwnProperty(CedarEmbeddableMetadataEditorComponent.SHOW_STATIC_TEXT)) {
        this.showStaticText = value[CedarEmbeddableMetadataEditorComponent.SHOW_STATIC_TEXT];
      }
    }
  }

  @Input() set templateJsonObject(value: object) {
    if (value != null) {
      this.dataContext.setInputTemplate(value, this.handlerContext, this.pageBreakPaginatorService, this.collapseStaticComponents);
      this.handlerContextEvent.emit(this.handlerContext);
    }
  }

  @Input() set metadataJsonObject(value: object) {
    if (value != null) {
      this.dataContext.setInputTemplate(value, this.handlerContext, this.pageBreakPaginatorService, this.collapseStaticComponents);
      this.handlerContextEvent.emit(this.handlerContext);
    }
  }

  dataAvailableForRender(): boolean {
    return this.dataContext != null
      && this.dataContext.templateRepresentation != null
      && !(this.dataContext.templateRepresentation instanceof NullTemplate)
      && this.dataContext.multiInstanceData != null;
  }

  openAll(): void {
    this.allExpanded = true;
  }

  closeAll(): void {
    this.allExpanded = false;
  }
}
