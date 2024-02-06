import { Component, Input, OnInit, ViewEncapsulation } from '@angular/core';
import { NullTemplate } from '../../models/template/null-template.model';
import { DataContext } from '../../util/data-context';
import { HandlerContext } from '../../util/handler-context';
import { PageBreakPaginatorService } from '../../service/page-break-paginator.service';
import { ActiveComponentRegistryService } from '../../service/active-component-registry.service';
import { DataObjectUtil } from '../../util/data-object-util';
import { MultiInstanceObjectHandler } from '../../handler/multi-instance-object.handler';
import { MessageHandlerService } from '../../service/message-handler.service';

@Component({
  selector: 'app-cedar-embeddable-metadata-editor',
  templateUrl: './cedar-embeddable-metadata-editor.component.html',
  styleUrls: ['./cedar-embeddable-metadata-editor.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class CedarEmbeddableMetadataEditorComponent implements OnInit {
  private static INNER_VERSION = '2024-02-06 17:00:00';

  private static SHOW_TEMPLATE_RENDERING = 'showTemplateRenderingRepresentation';
  private static SHOW_MULTI_INSTANCE = 'showMultiInstanceInfo';
  private static SHOW_TEMPLATE_SOURCE = 'showTemplateSourceData';
  private static SHOW_INSTANCE_CORE = 'showInstanceDataCore';
  private static SHOW_INSTANCE_FULL = 'showInstanceDataFull';
  private static SHOW_DATA_QUALITY_REPORT = 'showDataQualityReport';
  private static SHOW_SAMPLE_TEMPLATE_LINKS = 'showSampleTemplateLinks';

  private static SHOW_HEADER = 'showHeader';
  private static SHOW_FOOTER = 'showFooter';

  private static EXPANDED_TEMPLATE_RENDERING = 'expandedTemplateRenderingRepresentation';
  private static EXPANDED_MULTI_INSTANCE = 'expandedMultiInstanceInfo';
  private static EXPANDED_TEMPLATE_SOURCE = 'expandedTemplateSourceData';
  private static EXPANDED_INSTANCE_CORE = 'expandedInstanceDataCore';
  private static EXPANDED_INSTANCE_FULL = 'expandedInstanceDataFull';
  private static EXPANDED_DATA_QUALITY_REPORT = 'expandedDataQualityReport';
  private static EXPANDED_SAMPLE_TEMPLATE_LINKS = 'expandedSampleTemplateLinks';

  private static COLLAPSE_STATIC_COMPONENTS = 'collapseStaticComponents';
  private static SHOW_ALL_MULTI_INSTANCE_VALUES = 'showAllMultiInstanceValues';

  private static SHOW_STATIC_TEXT = 'showStaticText';

  static TEMPLATE_LOCATION_PREFIX = 'sampleTemplateLocationPrefix';
  static LOAD_SAMPLE_TEMPLATE_NAME = 'loadSampleTemplateName';
  static TERMINOLOGY_INTEGRATED_SEARCH_URL = 'terminologyIntegratedSearchUrl';
  static SHOW_SPINNER_BEFORE_INIT = 'showSpinnerBeforeInit';

  static FALLBACK_LANGUAGE = 'fallbackLanguage';
  static DEFAULT_LANGUAGE = 'defaultLanguage';

  private static IRI_PREFIX = 'iriPrefix';

  dataContext: DataContext = null;
  handlerContext: HandlerContext = null;

  pageBreakPaginatorService: PageBreakPaginatorService = null;

  @Input() sampleTemplateLoaderObject: any = null;

  showTemplateRenderingRepresentation = false;
  showMultiInstanceInfo = false;
  showTemplateSourceData = true;
  showInstanceDataCore = false;
  showInstanceDataFull = true;
  showDataQualityReport = false;
  showSampleTemplateLinks = false;
  showStaticText = true;

  showHeader = false;
  showFooter = false;

  expandedTemplateRenderingRepresentation = false;
  expandedMultiInstanceInfo = false;
  expandedTemplateSourceData = false;
  expandedInstanceDataCore = false;
  expandedInstanceDataFull = false;
  expandedDataQualityReport = false;
  expandedSampleTemplateLinks = false;

  collapseStaticComponents = false;
  showAllMultiInstanceValues = true;

  static iriPrefix = 'https://repo.metadatacenter.org/';

  allExpanded: boolean;

  constructor(
    private activeComponentRegistry: ActiveComponentRegistryService,
    private messageHandlerService: MessageHandlerService,
  ) {
    this.messageHandlerService.trace('CEDAR Embeddable Editor ' + CedarEmbeddableMetadataEditorComponent.INNER_VERSION);
  }

  ngOnInit(): void {}

  @Input() set dataContextObject(dataContext: DataContext) {
    this.dataContext = dataContext;
  }

  @Input() set handlerContextObject(handlerContext: HandlerContext) {
    this.handlerContext = handlerContext;
    this.pageBreakPaginatorService = new PageBreakPaginatorService(this.activeComponentRegistry, this.handlerContext);
  }

  @Input() set config(value: object) {
    if (value != null) {
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.SHOW_TEMPLATE_RENDERING)) {
        this.showTemplateRenderingRepresentation =
          value[CedarEmbeddableMetadataEditorComponent.SHOW_TEMPLATE_RENDERING];
      }
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.SHOW_MULTI_INSTANCE)) {
        this.showMultiInstanceInfo = value[CedarEmbeddableMetadataEditorComponent.SHOW_MULTI_INSTANCE];
      }
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.SHOW_TEMPLATE_SOURCE)) {
        this.showTemplateSourceData = value[CedarEmbeddableMetadataEditorComponent.SHOW_TEMPLATE_SOURCE];
      }
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.SHOW_INSTANCE_CORE)) {
        this.showInstanceDataCore = value[CedarEmbeddableMetadataEditorComponent.SHOW_INSTANCE_CORE];
      }
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.SHOW_INSTANCE_FULL)) {
        this.showInstanceDataFull = value[CedarEmbeddableMetadataEditorComponent.SHOW_INSTANCE_FULL];
      }
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.SHOW_DATA_QUALITY_REPORT)) {
        this.showDataQualityReport = value[CedarEmbeddableMetadataEditorComponent.SHOW_DATA_QUALITY_REPORT];
      }
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.SHOW_SAMPLE_TEMPLATE_LINKS)) {
        this.showSampleTemplateLinks = value[CedarEmbeddableMetadataEditorComponent.SHOW_SAMPLE_TEMPLATE_LINKS];
      }
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.SHOW_FOOTER)) {
        this.showFooter = value[CedarEmbeddableMetadataEditorComponent.SHOW_FOOTER];
      }
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.SHOW_HEADER)) {
        this.showHeader = value[CedarEmbeddableMetadataEditorComponent.SHOW_HEADER];
      }
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.EXPANDED_TEMPLATE_RENDERING)) {
        this.expandedTemplateRenderingRepresentation =
          value[CedarEmbeddableMetadataEditorComponent.EXPANDED_TEMPLATE_RENDERING];
      }
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.EXPANDED_MULTI_INSTANCE)) {
        this.expandedMultiInstanceInfo = value[CedarEmbeddableMetadataEditorComponent.EXPANDED_MULTI_INSTANCE];
      }
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.EXPANDED_TEMPLATE_SOURCE)) {
        this.expandedTemplateSourceData = value[CedarEmbeddableMetadataEditorComponent.EXPANDED_TEMPLATE_SOURCE];
      }
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.EXPANDED_INSTANCE_CORE)) {
        this.expandedInstanceDataCore = value[CedarEmbeddableMetadataEditorComponent.EXPANDED_INSTANCE_CORE];
      }
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.EXPANDED_INSTANCE_FULL)) {
        this.expandedInstanceDataFull = value[CedarEmbeddableMetadataEditorComponent.EXPANDED_INSTANCE_FULL];
      }
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.EXPANDED_DATA_QUALITY_REPORT)) {
        this.expandedDataQualityReport = value[CedarEmbeddableMetadataEditorComponent.EXPANDED_DATA_QUALITY_REPORT];
      }
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.EXPANDED_SAMPLE_TEMPLATE_LINKS)) {
        this.expandedSampleTemplateLinks = value[CedarEmbeddableMetadataEditorComponent.EXPANDED_SAMPLE_TEMPLATE_LINKS];
      }
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.COLLAPSE_STATIC_COMPONENTS)) {
        this.collapseStaticComponents = value[CedarEmbeddableMetadataEditorComponent.COLLAPSE_STATIC_COMPONENTS];
      }
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.SHOW_STATIC_TEXT)) {
        this.showStaticText = value[CedarEmbeddableMetadataEditorComponent.SHOW_STATIC_TEXT];
      }
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.IRI_PREFIX)) {
        CedarEmbeddableMetadataEditorComponent.iriPrefix = value[CedarEmbeddableMetadataEditorComponent.IRI_PREFIX];
      }
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.SHOW_ALL_MULTI_INSTANCE_VALUES)) {
        this.showAllMultiInstanceValues = value[CedarEmbeddableMetadataEditorComponent.SHOW_ALL_MULTI_INSTANCE_VALUES];
      }
    }
  }

  @Input() set templateJsonObject(value: object) {
    if (value != null) {
      this.dataContext.setInputTemplate(
        value,
        this.handlerContext,
        this.pageBreakPaginatorService,
        this.collapseStaticComponents,
      );
      this.initDataFromInstance(this.dataContext.instanceFullData);
    }
  }

  dataAvailableForRender(): boolean {
    return (
      this.dataContext != null &&
      this.dataContext.templateRepresentation != null &&
      !(this.dataContext.templateRepresentation instanceof NullTemplate) &&
      this.dataContext.multiInstanceData != null
    );
  }

  openAll(): void {
    this.allExpanded = true;
  }

  closeAll(): void {
    this.allExpanded = false;
  }

  public initDataFromInstance(instance: object): void {
    if (this.handlerContext) {
      const instanceFullData = JSON.parse(JSON.stringify(instance));
      const instanceExtractData = JSON.parse(JSON.stringify(instance));
      DataObjectUtil.deleteContext(instanceExtractData);
      const dataContext = this.handlerContext.dataContext;
      dataContext.instanceFullData = instanceFullData;
      dataContext.instanceExtractData = instanceExtractData;
      const multiInstanceObjectService: MultiInstanceObjectHandler = this.handlerContext.multiInstanceObjectService;

      dataContext.multiInstanceData = multiInstanceObjectService.buildNewOrFromMetadata(
        dataContext.templateRepresentation,
        instanceExtractData,
      );

      this.handlerContext.buildQualityReport();

      if (dataContext.templateRepresentation != null && dataContext.templateRepresentation.children != null) {
        setTimeout(() => {
          for (const childComponent of dataContext.templateRepresentation.children) {
            this.activeComponentRegistry.updateViewToModel(childComponent, this.handlerContext);
          }
        });
      }
    }
  }
}
