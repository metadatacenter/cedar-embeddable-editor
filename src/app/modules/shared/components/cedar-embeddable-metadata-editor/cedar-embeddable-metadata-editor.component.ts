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
import packageJson from 'package.json';
import { InstanceObject } from '../../models/instance-node.model';
import { DOWNLOAD_ITEMS, DownloadItemId } from '../../models/ui/download-item.model';
import { downloadContentFor, downloadFilenameFor } from '../../util/download-content';
import { triggerDownload } from '../../util/trigger-download';
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
  private static INNER_VERSION = '2026-08-12 17:12';

  /**
   * Whether the download menu exists.
   *
   * One key where there were sixteen: eight `show…` panels and their eight
   * `expanded…` partners, each rendering a dump under the form. The host decides
   * whether the menu is offered; what it offers is fixed.
   */
  private static SHOW_DOWNLOAD_MENU = 'showDownloadMenu';

  static TERMINOLOGY_INTEGRATED_SEARCH_URL = 'terminologyIntegratedSearchUrl';

  static FALLBACK_LANGUAGE = 'fallbackLanguage';
  static DEFAULT_LANGUAGE = 'defaultLanguage';
  static LANGUAGE_MAP_PATH_PREFIX = 'languageMapPathPrefix';
  static SHOW_TEMPLATE_DESCRIPTION: string = 'showTemplateDescription';

  /**
   * Whether the host vouches for its template's rich text.
   *
   * A static rich-text field's body renders as HTML in the host's own origin. CEE
   * sanitizes it unless this says otherwise, so an embedder that loads templates
   * chosen by its own users is safe without having to know that. See the embedding
   * security section of the README.
   */
  static TRUST_TEMPLATE_RICH_TEXT: string = 'trustTemplateRichText';

  static READ_ONLY_MODE: string = 'readOnlyMode';

  private static IRI_PREFIX = 'iriPrefix';

  static EXT_AUTH_BASE_URL = 'extAuthBaseUrl';

  dataContext: DataContext | null = null;
  handlerContext: HandlerContext | null = null;

  pageBreakPaginatorService: PageBreakPaginatorService | null = null;

  showDownloadMenu = false;

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

  /**
   * Save one of CEE's views of the artifact as a file.
   *
   * Traced rather than silent: a page-initiated download can be refused by a
   * sandboxed host with no event to observe, so a developer seeing the trace and
   * no file knows where to look.
   */
  download(id: DownloadItemId): void {
    const { dataContext } = this;
    if (dataContext === null) {
      return;
    }
    const filename = downloadFilenameFor(id, dataContext);
    const item = DOWNLOAD_ITEMS.find((candidate) => candidate.id === id);
    if (item === undefined) {
      return;
    }
    this.messageHandlerService.trace('CEDAR Embeddable Editor: downloading ' + filename);
    triggerDownload(filename, item.mediaType, downloadContentFor(id, dataContext));
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
      this.showDownloadMenu = configFlag(
        value,
        CedarEmbeddableMetadataEditorComponent.SHOW_DOWNLOAD_MENU,
        this.showDownloadMenu,
      );
      if (Object.hasOwn(value, CedarEmbeddableMetadataEditorComponent.IRI_PREFIX)) {
        this.iriPrefix.set(String(value[CedarEmbeddableMetadataEditorComponent.IRI_PREFIX]));
      }
      this.showTemplateDescription = configFlag(
        value,
        CedarEmbeddableMetadataEditorComponent.SHOW_TEMPLATE_DESCRIPTION,
        this.showTemplateDescription,
      );

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

      this.templateTrustService.setTrustTemplateRichText(
        configFlag(
          value,
          CedarEmbeddableMetadataEditorComponent.TRUST_TEMPLATE_RICH_TEXT,
          this.templateTrustService.trustTemplateRichText,
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
    dataContext.setInputTemplate(templateObject, handlerContext, pageBreakPaginatorService);
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
