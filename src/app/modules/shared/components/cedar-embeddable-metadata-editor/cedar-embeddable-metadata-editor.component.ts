import { Component, Input, OnDestroy, ViewEncapsulation } from '@angular/core';
import { NullTemplate } from '../../models/template/null-template.model';
import { DataContext } from '../../util/data-context';
import { HandlerContext } from '../../util/handler-context';
import { PageBreakPaginatorService } from '../../service/page-break-paginator.service';
import { ActiveComponentRegistryService } from '../../service/active-component-registry.service';
import { InstanceDeserializer } from '../../util/instance-deserializer';
import { ExternalAuthorityLookupService } from '../../service/external-authority-lookup.service';
import { AUTHORITY_DESCRIPTORS } from '../../models/authority/authority-descriptor.model';
import { IriPrefix } from '../../util/iri-prefix';
import { MultiInstanceObjectHandler } from '../../handler/multi-instance-object.handler';
import { MessageHandlerService } from '../../service/message-handler.service';
import { TemplateParser } from '../../factory/template-parser';
import { ModelLibraryTemplateParser } from '../../factory/model-library-template-parser';
import { YamlTemplateParser } from '../../factory/yaml-template-parser';
import packageJson from 'package.json';

@Component({
  selector: 'app-cedar-embeddable-metadata-editor',
  templateUrl: './cedar-embeddable-metadata-editor.component.html',
  styleUrls: ['./cedar-embeddable-metadata-editor.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  standalone: false,
})
export class CedarEmbeddableMetadataEditorComponent implements OnDestroy {
  private static INNER_VERSION = '2026-08-07 14:08 9009e4b';

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
  static SHOW_PREFERENCES_MENU: string = 'showPreferencesMenu';

  private static IRI_PREFIX = 'iriPrefix';
  // Input and output serialization are configured independently: a host can hand
  // CEE a JSON template and read its instance back as YAML, or the reverse.
  static INPUT_SERIALIZATION = 'inputSerialization';
  static OUTPUT_SERIALIZATION = 'outputSerialization';
  static SERIALIZATION_YAML = 'yaml';
  private static BIO_PORTAL_PREFIX = 'bioPortalPrefix';
  private static ORCID_PREFIX = 'orcidPrefix';
  private static ROR_PREFIX = 'rorPrefix';

  static EXT_AUTH_BASE_URL = 'extAuthBaseUrl';

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
  // Which parser turns the template a host hands in into the component tree.
  // JSON by default; a host reading its templates as CEDAR YAML sets
  // `inputSerialization: 'yaml'` in the config to switch it, and passes the
  // YAML-parsed object. Input and output serialization are independent.
  templateParser: TemplateParser = new ModelLibraryTemplateParser();
  showAllMultiInstanceValues = true;
  showTemplateDescription: boolean = false;
  readOnlyMode: boolean = false;
  showPreferencesMenu: boolean = true;

  // Embedders work against CEDAR's production bridge unless they explicitly
  // point at another deployment. The standalone developer app overrides this
  // with the local `.orgx` host in app.component.dev.ts.
  extAuthBaseUrl: string = 'https://bridge.metadatacenter.org/ext-auth/';

  private initDataFromInstanceQueue: Promise<void> = Promise.resolve();

  allExpanded = true;
  ceeVersion: string;

  constructor(
    private activeComponentRegistry: ActiveComponentRegistryService,
    private externalAuthorityLookupService: ExternalAuthorityLookupService,
    private messageHandlerService: MessageHandlerService,
    private iriPrefix: IriPrefix,
  ) {
    this.ceeVersion = packageJson.version;
    this.messageHandlerService.trace('CEDAR Embeddable Editor ' + CedarEmbeddableMetadataEditorComponent.INNER_VERSION);
  }

  ngOnDestroy(): void {
    this.activeComponentRegistry.clear();
  }

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
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.INPUT_SERIALIZATION)) {
        const inputSerialization = value[CedarEmbeddableMetadataEditorComponent.INPUT_SERIALIZATION];
        this.templateParser =
          inputSerialization === CedarEmbeddableMetadataEditorComponent.SERIALIZATION_YAML
            ? new YamlTemplateParser()
            : new ModelLibraryTemplateParser();
      }
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.SHOW_STATIC_TEXT)) {
        this.showStaticText = value[CedarEmbeddableMetadataEditorComponent.SHOW_STATIC_TEXT];
      }
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.IRI_PREFIX)) {
        this.iriPrefix.set(value[CedarEmbeddableMetadataEditorComponent.IRI_PREFIX]);
      }
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.SHOW_ALL_MULTI_INSTANCE_VALUES)) {
        this.showAllMultiInstanceValues = value[CedarEmbeddableMetadataEditorComponent.SHOW_ALL_MULTI_INSTANCE_VALUES];
      }
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.SHOW_TEMPLATE_DESCRIPTION)) {
        this.showTemplateDescription = value[CedarEmbeddableMetadataEditorComponent.SHOW_TEMPLATE_DESCRIPTION];
      }
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.BIO_PORTAL_PREFIX)) {
        this.iriPrefix.setBioPortalPrefix(value[CedarEmbeddableMetadataEditorComponent.BIO_PORTAL_PREFIX]);
      }
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.ORCID_PREFIX)) {
        this.iriPrefix.setOrcidPrefix(value[CedarEmbeddableMetadataEditorComponent.ORCID_PREFIX]);
      }
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.ROR_PREFIX)) {
        this.iriPrefix.setRorPrefix(value[CedarEmbeddableMetadataEditorComponent.ROR_PREFIX]);
      }

      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.EXT_AUTH_BASE_URL)) {
        this.extAuthBaseUrl = value[CedarEmbeddableMetadataEditorComponent.EXT_AUTH_BASE_URL];
      }

      // Every external authority's two endpoints, in one loop.
      //
      // This was fourteen near-identical blocks — read a config key, fall back to
      // a default path, prepend the base URL, hand the result to that
      // authority's own service. An eighth authority cost two more blocks, a new
      // service, and a new injected dependency here. The keys and defaults now
      // live on the descriptor, so it costs a descriptor.
      for (const descriptor of AUTHORITY_DESCRIPTORS) {
        const searchPath = Object.hasOwn(value, descriptor.searchUrlConfigKey)
          ? value[descriptor.searchUrlConfigKey]
          : descriptor.defaultSearchPath;
        const detailsPath = Object.hasOwn(value, descriptor.detailsUrlConfigKey)
          ? value[descriptor.detailsUrlConfigKey]
          : descriptor.defaultDetailsPath;
        this.externalAuthorityLookupService.setEndpoints(
          descriptor.inputType,
          this.extAuthBaseUrl + searchPath,
          this.extAuthBaseUrl + detailsPath,
        );
      }

      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.READ_ONLY_MODE)) {
        this.readOnlyMode = value[CedarEmbeddableMetadataEditorComponent.READ_ONLY_MODE];
      }
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.SHOW_PREFERENCES_MENU)) {
        this.showPreferencesMenu = value[CedarEmbeddableMetadataEditorComponent.SHOW_PREFERENCES_MENU];
      }
    }
  }

  @Input() set templateJsonObject(value: object) {
    if (value != null) {
      if (this.handlerContext.hideEmptyFields) {
        this.messageHandlerService.trace('HideEmptyFields can not be used and set to false');
        this.handlerContext.hideEmptyFields = false;
      }
      this.replaceInputTemplate(value);
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
    // @ts-expect-error - templateAndInstance is typed as `object`
    const { templateObject, instanceObject } = templateAndInstance;
    if (!templateObject) {
      this.messageHandlerService.error('Template Object is missing.');
      return;
    } else if (!instanceObject) {
      this.messageHandlerService.error('Instance Object is missing.');
      return;
    }
    this.setDataContextWithInstance(instanceObject);
    this.replaceInputTemplate(templateObject);
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

  private replaceInputTemplate(templateObject: object): void {
    this.dataContext.setInputTemplate(
      templateObject,
      this.handlerContext,
      this.pageBreakPaginatorService,
      this.collapseStaticComponents,
      this.templateParser,
    );
    // The old component tree remains alive until Angular's next render pass.
    // Drop its strong references immediately after the replacement succeeds.
    this.activeComponentRegistry.clear();
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

  /**
   * Take in the instance the host page handed us.
   *
   * Read once by the model library and projected into the two trees CEE edits.
   * It used to be cloned twice, with one copy walked to delete envelope keys —
   * a walk that had to guess from an untyped object which nodes were values,
   * and got it wrong for any IRI carrying a `@type`. See `InstanceDeserializer`.
   */
  setDataContextWithInstance(instanceObject): void {
    const { full } = InstanceDeserializer.read(instanceObject, (message) => this.messageHandlerService.error(message));
    const dataContext = this.handlerContext.dataContext;
    dataContext.instanceFullData = full;
    dataContext.invalidateDerivedViews();
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
