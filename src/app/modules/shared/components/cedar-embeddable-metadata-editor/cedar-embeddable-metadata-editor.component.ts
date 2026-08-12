import { Component, Input, OnDestroy, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { NullTemplate } from '../../models/template/null-template.model';
import { DataContext } from '../../util/data-context';
import { HandlerContext } from '../../util/handler-context';
import { PageBreakPaginatorService } from '../../service/page-break-paginator.service';
import { ActiveComponentRegistryService } from '../../service/active-component-registry.service';
import { InstanceSerializer } from '../../util/instance-serializer';
import { InstanceDeserializer } from '../../util/instance-deserializer';
import { ExternalAuthorityLookupService } from '../../service/external-authority-lookup.service';
import { AUTHORITY_DESCRIPTORS } from '../../models/authority/authority-descriptor.model';
import { IriPrefix } from '../../util/iri-prefix';
import { TemplateTrustService } from '../../service/template-trust.service';
import { UserPreferencesService } from '../../service/user-preferences.service';
import { MultiInstanceObjectHandler } from '../../handler/multi-instance-object.handler';
import { MessageHandlerService } from '../../service/message-handler.service';
import { TemplateParser } from '../../factory/template-parser';
import { ModelLibraryTemplateParser } from '../../factory/model-library-template-parser';
import { YamlTemplateParser } from '../../factory/yaml-template-parser';
import packageJson from 'package.json';
import { SampleTemplateLoaderOwner } from '../../models/ui/sample-template-loader-owner.model';
import { InstanceObject } from '../../models/instance-node.model';
import { CeeConfig, configFlag, configText } from '../../util/config-reader';

@Component({
  selector: 'app-cedar-embeddable-metadata-editor',
  templateUrl: './cedar-embeddable-metadata-editor.component.html',
  styleUrls: ['./cedar-embeddable-metadata-editor.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarEmbeddableMetadataEditorComponent implements OnDestroy {
  private static INNER_VERSION = '2026-08-12 08:46 b953153';

  private static SHOW_TEMPLATE_RENDERING = 'showTemplateRenderingRepresentation';
  private static SHOW_MULTI_INSTANCE = 'showMultiInstanceInfo';
  private static SHOW_TEMPLATE_SOURCE = 'showTemplateSourceData';
  private static SHOW_TEMPLATE_YAML = 'showTemplateYaml';
  private static SHOW_INSTANCE_CORE = 'showInstanceDataCore';
  private static SHOW_INSTANCE_FULL = 'showInstanceDataFull';
  private static SHOW_INSTANCE_YAML = 'showInstanceYaml';
  private static SHOW_DATA_QUALITY_REPORT = 'showDataQualityReport';
  private static SHOW_SAMPLE_TEMPLATE_LINKS = 'showSampleTemplateLinks';

  private static SHOW_HEADER = 'showHeader';
  private static SHOW_FOOTER = 'showFooter';

  private static EXPANDED_TEMPLATE_RENDERING = 'expandedTemplateRenderingRepresentation';
  private static EXPANDED_MULTI_INSTANCE = 'expandedMultiInstanceInfo';
  private static EXPANDED_TEMPLATE_SOURCE = 'expandedTemplateSourceData';
  private static EXPANDED_TEMPLATE_YAML = 'expandedTemplateYaml';
  private static EXPANDED_INSTANCE_CORE = 'expandedInstanceDataCore';
  private static EXPANDED_INSTANCE_FULL = 'expandedInstanceDataFull';
  private static EXPANDED_INSTANCE_YAML = 'expandedInstanceYaml';
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

  /**
   * Whether the host vouches for its template's markup.
   *
   * A static rich-text field's body renders as HTML in the host's own origin. CEE
   * sanitizes it unless this says otherwise, so an embedder that loads templates
   * chosen by its own users is safe without having to know that. See the embedding
   * security section of the README.
   */
  static TRUST_TEMPLATE_MARKUP: string = 'trustTemplateMarkup';

  static READ_ONLY_MODE: string = 'readOnlyMode';
  static HIDE_EMPTY_FIELDS: string = 'hideEmptyFields';

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

  dataContext: DataContext | null = null;
  handlerContext: HandlerContext | null = null;

  pageBreakPaginatorService: PageBreakPaginatorService | null = null;

  @Input() sampleTemplateLoaderObject: SampleTemplateLoaderOwner | null = null;

  showTemplateRenderingRepresentation = false;
  showMultiInstanceInfo = false;
  showTemplateSourceData = true;
  showTemplateYaml = false;
  showInstanceDataCore = false;
  showInstanceDataFull = true;
  showInstanceYaml = false;
  showDataQualityReport = false;
  showSampleTemplateLinks = false;
  showStaticText = true;

  showHeader = false;
  showFooter = false;

  expandedTemplateRenderingRepresentation = false;
  expandedMultiInstanceInfo = false;
  expandedTemplateSourceData = false;
  expandedTemplateYaml = false;
  expandedInstanceDataCore = false;
  expandedInstanceDataFull = false;
  expandedInstanceYaml = false;
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
    private templateTrustService: TemplateTrustService,
    private userPreferencesService: UserPreferencesService,
  ) {
    this.ceeVersion = packageJson.version;
    this.messageHandlerService.trace('CEDAR Embeddable Editor ' + CedarEmbeddableMetadataEditorComponent.INNER_VERSION);
  }

  ngOnDestroy(): void {
    this.activeComponentRegistry.clear();
  }

  @Input() set dataContextObject(dataContext: DataContext | null) {
    this.dataContext = dataContext;
  }

  @Input() set handlerContextObject(handlerContext: HandlerContext | null) {
    this.handlerContext = handlerContext;
    this.pageBreakPaginatorService =
      handlerContext === null ? null : new PageBreakPaginatorService(this.activeComponentRegistry, handlerContext);
  }

  @Input() set config(value: CeeConfig | null) {
    if (value != null) {
      this.showTemplateRenderingRepresentation = configFlag(
        value,
        CedarEmbeddableMetadataEditorComponent.SHOW_TEMPLATE_RENDERING,
        this.showTemplateRenderingRepresentation,
      );
      this.showMultiInstanceInfo = configFlag(
        value,
        CedarEmbeddableMetadataEditorComponent.SHOW_MULTI_INSTANCE,
        this.showMultiInstanceInfo,
      );
      this.showTemplateSourceData = configFlag(
        value,
        CedarEmbeddableMetadataEditorComponent.SHOW_TEMPLATE_SOURCE,
        this.showTemplateSourceData,
      );
      this.showTemplateYaml = configFlag(
        value,
        CedarEmbeddableMetadataEditorComponent.SHOW_TEMPLATE_YAML,
        this.showTemplateYaml,
      );
      this.showInstanceDataCore = configFlag(
        value,
        CedarEmbeddableMetadataEditorComponent.SHOW_INSTANCE_CORE,
        this.showInstanceDataCore,
      );
      this.showInstanceDataFull = configFlag(
        value,
        CedarEmbeddableMetadataEditorComponent.SHOW_INSTANCE_FULL,
        this.showInstanceDataFull,
      );
      this.showInstanceYaml = configFlag(
        value,
        CedarEmbeddableMetadataEditorComponent.SHOW_INSTANCE_YAML,
        this.showInstanceYaml,
      );
      this.showDataQualityReport = configFlag(
        value,
        CedarEmbeddableMetadataEditorComponent.SHOW_DATA_QUALITY_REPORT,
        this.showDataQualityReport,
      );
      this.showSampleTemplateLinks = configFlag(
        value,
        CedarEmbeddableMetadataEditorComponent.SHOW_SAMPLE_TEMPLATE_LINKS,
        this.showSampleTemplateLinks,
      );
      this.showFooter = configFlag(value, CedarEmbeddableMetadataEditorComponent.SHOW_FOOTER, this.showFooter);
      this.showHeader = configFlag(value, CedarEmbeddableMetadataEditorComponent.SHOW_HEADER, this.showHeader);
      this.expandedTemplateRenderingRepresentation = configFlag(
        value,
        CedarEmbeddableMetadataEditorComponent.EXPANDED_TEMPLATE_RENDERING,
        this.expandedTemplateRenderingRepresentation,
      );
      this.expandedMultiInstanceInfo = configFlag(
        value,
        CedarEmbeddableMetadataEditorComponent.EXPANDED_MULTI_INSTANCE,
        this.expandedMultiInstanceInfo,
      );
      this.expandedTemplateSourceData = configFlag(
        value,
        CedarEmbeddableMetadataEditorComponent.EXPANDED_TEMPLATE_SOURCE,
        this.expandedTemplateSourceData,
      );
      this.expandedTemplateYaml = configFlag(
        value,
        CedarEmbeddableMetadataEditorComponent.EXPANDED_TEMPLATE_YAML,
        this.expandedTemplateYaml,
      );
      this.expandedInstanceDataCore = configFlag(
        value,
        CedarEmbeddableMetadataEditorComponent.EXPANDED_INSTANCE_CORE,
        this.expandedInstanceDataCore,
      );
      this.expandedInstanceDataFull = configFlag(
        value,
        CedarEmbeddableMetadataEditorComponent.EXPANDED_INSTANCE_FULL,
        this.expandedInstanceDataFull,
      );
      this.expandedInstanceYaml = configFlag(
        value,
        CedarEmbeddableMetadataEditorComponent.EXPANDED_INSTANCE_YAML,
        this.expandedInstanceYaml,
      );
      this.expandedDataQualityReport = configFlag(
        value,
        CedarEmbeddableMetadataEditorComponent.EXPANDED_DATA_QUALITY_REPORT,
        this.expandedDataQualityReport,
      );
      this.expandedSampleTemplateLinks = configFlag(
        value,
        CedarEmbeddableMetadataEditorComponent.EXPANDED_SAMPLE_TEMPLATE_LINKS,
        this.expandedSampleTemplateLinks,
      );
      this.collapseStaticComponents = configFlag(
        value,
        CedarEmbeddableMetadataEditorComponent.COLLAPSE_STATIC_COMPONENTS,
        this.collapseStaticComponents,
      );
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.INPUT_SERIALIZATION)) {
        const inputSerialization = value[CedarEmbeddableMetadataEditorComponent.INPUT_SERIALIZATION];
        this.templateParser =
          inputSerialization === CedarEmbeddableMetadataEditorComponent.SERIALIZATION_YAML
            ? new YamlTemplateParser()
            : new ModelLibraryTemplateParser();
      }
      this.showStaticText = configFlag(
        value,
        CedarEmbeddableMetadataEditorComponent.SHOW_STATIC_TEXT,
        this.showStaticText,
      );
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.IRI_PREFIX)) {
        this.iriPrefix.set(String(value[CedarEmbeddableMetadataEditorComponent.IRI_PREFIX]));
      }
      this.showAllMultiInstanceValues = configFlag(
        value,
        CedarEmbeddableMetadataEditorComponent.SHOW_ALL_MULTI_INSTANCE_VALUES,
        this.showAllMultiInstanceValues,
      );
      this.showTemplateDescription = configFlag(
        value,
        CedarEmbeddableMetadataEditorComponent.SHOW_TEMPLATE_DESCRIPTION,
        this.showTemplateDescription,
      );
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.BIO_PORTAL_PREFIX)) {
        this.iriPrefix.setBioPortalPrefix(String(value[CedarEmbeddableMetadataEditorComponent.BIO_PORTAL_PREFIX]));
      }
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.ORCID_PREFIX)) {
        this.iriPrefix.setOrcidPrefix(String(value[CedarEmbeddableMetadataEditorComponent.ORCID_PREFIX]));
      }
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.ROR_PREFIX)) {
        this.iriPrefix.setRorPrefix(String(value[CedarEmbeddableMetadataEditorComponent.ROR_PREFIX]));
      }

      this.extAuthBaseUrl = configText(
        value,
        CedarEmbeddableMetadataEditorComponent.EXT_AUTH_BASE_URL,
        this.extAuthBaseUrl,
      );

      // Every external authority's two endpoints, in one loop.
      //
      // This was fourteen near-identical blocks — read a config key, fall back to
      // a default path, prepend the base URL, hand the result to that
      // authority's own service. An eighth authority cost two more blocks, a new
      // service, and a new injected dependency here. The keys and defaults now
      // live on the descriptor, so it costs a descriptor.
      for (const descriptor of AUTHORITY_DESCRIPTORS) {
        const searchPath = configText(value, descriptor.searchUrlConfigKey, descriptor.defaultSearchPath);
        const detailsPath = configText(value, descriptor.detailsUrlConfigKey, descriptor.defaultDetailsPath);
        this.externalAuthorityLookupService.setEndpoints(
          descriptor.inputType,
          this.extAuthBaseUrl + searchPath,
          this.extAuthBaseUrl + detailsPath,
        );
      }

      this.templateTrustService.setTrustTemplateMarkup(
        configFlag(
          value,
          CedarEmbeddableMetadataEditorComponent.TRUST_TEMPLATE_MARKUP,
          this.templateTrustService.trustTemplateMarkup,
        ),
      );

      this.readOnlyMode = configFlag(value, CedarEmbeddableMetadataEditorComponent.READ_ONLY_MODE, this.readOnlyMode);
      /*
       * The widgets read read-only from `UserPreferencesService`, and this is what
       * puts it there.
       *
       * It used to travel through the preferences menu: the host's flag was an input
       * on that component, whose setter wrote to the service. So a piece of host
       * configuration reached the form only by passing through a UI control — which
       * is how the control came to be able to override it, and why the menu had to
       * stay instantiated even when configured invisible, or read-only never
       * arrived at all.
       */
      this.userPreferencesService.setReadOnlyMode(this.readOnlyMode);
    }
  }

  /*
   * Both artifact setters run before the contexts are guaranteed, because a host is
   * free to set `templateJsonObject` before `handlerContextObject`. The early return
   * says that once instead of at each of the six reads below it.
   *
   * Neither setter clears `hideEmptyFields` any more. Both used to, on the reasoning
   * that a new artifact invalidates a hiding decision made against the old one — but
   * an artifact now arrives once, and on that single pass the clear fired *after* the
   * configuration set the flag, so `hideEmptyFields: true` never survived startup.
   * Nothing caught it: the only test of the flag exercises the wrapper alone, with no
   * child editor and no template, so it watched the flag being set and never saw
   * either setter run. With configuration immutable the clear would be unrecoverable.
   */
  @Input() set templateJsonObject(value: object | null) {
    const { dataContext, handlerContext } = this;
    if (value == null || dataContext == null || handlerContext == null) {
      return;
    }
    this.replaceInputTemplate(value);
    setTimeout(() => {
      const instance = dataContext.instanceFullData;
      if (instance !== null) {
        // Written out, then read back against the template that just replaced the
        // old one. The instance in hand was read against the *previous* template,
        // so re-reading is the point — and a document is what the read takes.
        this.initDataFromInstance(InstanceSerializer.toJson(instance))
          .then(() => {})
          .catch(() => {});
      }
    });
  }

  @Input() set instanceJsonObject(value: InstanceObject | null) {
    if (value == null || this.handlerContext == null) {
      return;
    }
    setTimeout(() => {
      this.initDataFromInstance(value)
        .then(() => {})
        .catch(() => {});
    });
  }

  @Input() set templateAndInstanceObject(templateAndInstance: object | null) {
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
    const { dataContext, handlerContext, pageBreakPaginatorService } = this;
    if (dataContext == null || handlerContext == null) {
      return;
    }
    dataContext.setInputTemplate(
      templateObject,
      handlerContext,
      pageBreakPaginatorService,
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
      // `templateRepresentation` is null only before a template has been set, and
      // an instance cannot arrive first — `initDataFromInstance` is reached from the
      // artifact setters, both of which run `replaceInputTemplate` ahead of it.
      const representation = dataContext.templateRepresentation;
      if (representation === null) {
        return;
      }
      dataContext.multiInstanceData = multiInstanceObjectService.buildNewOrFromMetadata(
        representation,
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
  setDataContextWithInstance(instanceObject: object): void {
    const handlerContext = this.handlerContext;
    if (handlerContext == null) {
      return;
    }
    const { full } = InstanceDeserializer.read(instanceObject, (message) => this.messageHandlerService.error(message));
    const dataContext = handlerContext.dataContext;
    dataContext.instanceFullData = full;
    dataContext.invalidateDerivedViews();
  }

  private async renderInstance(dataContext: DataContext): Promise<void> {
    this.initDataFromInstanceQueue = this.initDataFromInstanceQueue.finally(async () => {
      // Held in a local: the deferred callback runs a tick later, and the two
      // reads of `dataContext.templateRepresentation` that the check guarded were
      // separate reads of a mutable field rather than one narrowed value.
      const representation = dataContext.templateRepresentation;
      const handlerContext = this.handlerContext;
      if (representation != null && representation.children != null && handlerContext != null) {
        await new Promise<void>((resolve) => {
          setTimeout(() => {
            for (const childComponent of representation.children) {
              this.activeComponentRegistry.updateViewToModel(childComponent, handlerContext);
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
