import { Component, Input, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { NullTemplate } from '../../models/template/null-template.model';
import { DataContext } from '../../util/data-context';
import { HandlerContext } from '../../util/handler-context';
import { PageBreakPaginatorService } from '../../service/page-break-paginator.service';
import { ActiveComponentRegistryService } from '../../service/active-component-registry.service';
import { DataObjectUtil } from '../../util/data-object-util';
import { MultiInstanceObjectHandler } from '../../handler/multi-instance-object.handler';
import { MessageHandlerService } from '../../service/message-handler.service';
import { RorFieldDataService } from '../../service/ror-field-data.service';
import { OrcidFieldDataService } from '../../service/orcid-field-data.service';
import { UserPreferencesMenu } from '../user-preferences-menu/user-preferences-menu.component';
import packageJson from 'package.json';

@Component({
  selector: 'app-cedar-embeddable-metadata-editor',
  templateUrl: './cedar-embeddable-metadata-editor.component.html',
  styleUrls: ['./cedar-embeddable-metadata-editor.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class CedarEmbeddableMetadataEditorComponent implements OnInit {
  @ViewChild(UserPreferencesMenu, { static: true }) UserPreferencesMenu;
  private static INNER_VERSION = '2025-05-15 02:40:00';

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
  static LANGUAGE_MAP_PATH_PREFIX = 'languageMapPathPrefix';
  static SHOW_TEMPLATE_DESCRIPTION: string = 'showTemplateDescription';

  static READ_ONLY_MODE: string = 'readOnlyMode';
  static HIDE_EMPTY_FIELDS: string = 'hideEmptyFields';

  private static IRI_PREFIX = 'iriPrefix';
  private static BIO_PORTAL_PREFIX = 'bioPortalPrefix';
  private static ORCID_PREFIX = 'orcidPrefix';
  private static ROR_PREFIX = 'rorPrefix';

  static ROR_INTEGRATED_EXT_AUTH_URL = 'rorIntegratedExtAuthUrl';
  static ROR_INTEGRATED_DETAILS_URL = 'rorIntegratedDetailsUrl';
  static ORCID_INTEGRATED_EXT_AUTH_URL = 'orcidIntegratedExtAuthUrl';
  static ORCID_INTEGRATED_DETAILS_URL = 'orcidIntegratedDetailsUrl';

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
  showTemplateDescription: boolean = false;
  readOnlyMode: boolean = false;

  static iriPrefix = 'https://repo.metadatacenter.org/';
  static bioPortalPrefix = 'https://bioportal.bioontology.org/ontologies/';
  static orcidPrefix = 'https://orcid.org/';
  static rorPrefix = 'https://ror.org/';
  orcidSearchUrl = 'https://bridge.metadatacenter.orgx/ext-auth/orcid/search-by-name';
  rorSearchUrl = 'https://bridge.metadatacenter.orgx/ext-auth/ror/search-by-name';
  orcidDetailsUrl = 'https://bridge.metadatacenter.orgx/ext-auth/orcid';
  rorDetailsUrl = 'https://bridge.metadatacenter.orgx/ext-auth/ror';

  private initDataFromInstanceQueue: Promise<void> = Promise.resolve();

  allExpanded = true;
  ceeVersion: string;

  constructor(
    private activeComponentRegistry: ActiveComponentRegistryService,
    private messageHandlerService: MessageHandlerService,
    private rorFieldDataService: RorFieldDataService,
    private orcidFieldDataService: OrcidFieldDataService,
  ) {
    this.ceeVersion = packageJson.version;
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
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.SHOW_TEMPLATE_DESCRIPTION)) {
        this.showTemplateDescription = value[CedarEmbeddableMetadataEditorComponent.SHOW_TEMPLATE_DESCRIPTION];
      }
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.BIO_PORTAL_PREFIX)) {
        CedarEmbeddableMetadataEditorComponent.bioPortalPrefix =
          value[CedarEmbeddableMetadataEditorComponent.BIO_PORTAL_PREFIX];
      }
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.ORCID_PREFIX)) {
        CedarEmbeddableMetadataEditorComponent.orcidPrefix = value[CedarEmbeddableMetadataEditorComponent.ORCID_PREFIX];
      }
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.ROR_PREFIX)) {
        CedarEmbeddableMetadataEditorComponent.rorPrefix = value[CedarEmbeddableMetadataEditorComponent.ROR_PREFIX];
      }

      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.ROR_INTEGRATED_EXT_AUTH_URL)) {
        this.rorSearchUrl = value[CedarEmbeddableMetadataEditorComponent.ROR_INTEGRATED_EXT_AUTH_URL];
      }
      this.rorFieldDataService.setRorSearchUrl(this.rorSearchUrl);

      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.ORCID_INTEGRATED_EXT_AUTH_URL)) {
        this.orcidSearchUrl = value[CedarEmbeddableMetadataEditorComponent.ORCID_INTEGRATED_EXT_AUTH_URL];
      }
      this.orcidFieldDataService.setOrcidSearchUrl(this.orcidSearchUrl);

      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.ROR_INTEGRATED_DETAILS_URL)) {
        this.rorDetailsUrl = value[CedarEmbeddableMetadataEditorComponent.ROR_INTEGRATED_DETAILS_URL];
      }
      this.rorFieldDataService.setRorDetailsUrl(this.rorDetailsUrl);

      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.ORCID_INTEGRATED_DETAILS_URL)) {
        this.orcidDetailsUrl = value[CedarEmbeddableMetadataEditorComponent.ORCID_INTEGRATED_DETAILS_URL];
      }
      this.orcidFieldDataService.setOrcidDetailsUrl(this.orcidDetailsUrl);

      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.READ_ONLY_MODE)) {
        this.readOnlyMode = value[CedarEmbeddableMetadataEditorComponent.READ_ONLY_MODE];
        if (this.readOnlyMode) {
          this.UserPreferencesMenu.enableReadOnlyMode();
        }
      }
    }
  }

  @Input() set templateJsonObject(value: object) {
    if (value != null) {
      if (this.handlerContext.hideEmptyFields) {
        this.messageHandlerService.trace('HideEmptyFields can not be used and set to false');
        this.handlerContext.hideEmptyFields = false;
      }
      this.dataContext.setInputTemplate(
        value,
        this.handlerContext,
        this.pageBreakPaginatorService,
        this.collapseStaticComponents,
      );
      setTimeout(() => {
        this.initDataFromInstance(this.dataContext.instanceFullData)
          .then(() => {})
          .catch(() => {});
      });
    }
  }

  @Input() set instanceJsonObject(value: object) {
    if (value != null) {
      if (this.handlerContext.hideEmptyFields) {
        this.messageHandlerService.trace('HideEmptyFields can not be used and set to false');
        this.handlerContext.hideEmptyFields = false;
      }
      setTimeout(() => {
        this.initDataFromInstance(value)
          .then(() => {})
          .catch(() => {});
      });
    }
  }

  @Input() set templateAndInstanceObject(templateAndInstance: object) {
    if (templateAndInstance === null) {
      return;
    }
    // TODO: an interface for templateAndInstance object
    // @ts-ignore
    const { templateObject, instanceObject } = templateAndInstance;
    if (!templateObject) {
      this.messageHandlerService.error('Template Object is missing.');
      return;
    } else if (!instanceObject) {
      this.messageHandlerService.error('Instance Object is missing.');
      return;
    }
    this.setDataContextWithInstance(instanceObject);
    this.dataContext.setInputTemplate(
      templateObject,
      this.handlerContext,
      this.pageBreakPaginatorService,
      this.collapseStaticComponents,
    );
    setTimeout(() => {
      this.initDataWithDataContext()
        .then(() => {})
        .catch(() => {});
    });
  }
  private async initDataWithDataContext(): Promise<void> {
    if (this.handlerContext) {
      const dataContext = this.handlerContext.dataContext;
      this.handlerContext.buildQualityReport();
      return this.renderInstance(dataContext);
    }
  }
  private async initDataFromInstance(instance: object): Promise<void> {
    if (this.handlerContext) {
      this.setDataContextWithInstance(instance);
      const dataContext = this.handlerContext.dataContext;
      const multiInstanceObjectService: MultiInstanceObjectHandler = this.handlerContext.multiInstanceObjectService;
      dataContext.multiInstanceData = multiInstanceObjectService.buildNewOrFromMetadata(
        dataContext.templateRepresentation,
        dataContext.instanceExtractData,
      );
      return this.renderInstance(dataContext);
    }
  }
  setDataContextWithInstance(instanceObject): void {
    const instanceFullData = JSON.parse(JSON.stringify(instanceObject));
    const instanceExtractData = JSON.parse(JSON.stringify(instanceObject));
    DataObjectUtil.deleteContext(instanceExtractData);
    const dataContext = this.handlerContext.dataContext;
    dataContext.instanceFullData = instanceFullData;
    dataContext.instanceExtractData = instanceExtractData;
  }
  private async renderInstance(dataContext): Promise<void> {
    this.initDataFromInstanceQueue = this.initDataFromInstanceQueue.finally(async () => {
      if (dataContext.templateRepresentation != null && dataContext.templateRepresentation.children != null) {
        await new Promise<void>((resolve) => {
          setTimeout(() => {
            for (const childComponent of dataContext.templateRepresentation.children) {
              this.activeComponentRegistry.updateViewToModel(childComponent, this.handlerContext);
            }
            resolve();
          });
        });
      }
    });
    return this.initDataFromInstanceQueue;
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
  launchMetadataCenter() {
    window.open('https://metadatacenter.org/', '_blank');
  }
}
