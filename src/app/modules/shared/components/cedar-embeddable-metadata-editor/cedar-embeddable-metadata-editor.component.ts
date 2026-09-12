import { Component, Input, OnDestroy, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import type { Template } from 'cedar-model-typescript-library';
import { CedarTemplate } from '../../models/template/cedar-template.model';
import { NullTemplate } from '../../models/template/null-template.model';
import { DataContext } from '../../util/data-context';
import { HandlerContext } from '../../util/handler-context';
import { PageBreakPaginatorService } from '../../service/page-break-paginator.service';
import { ActiveComponentRegistryService } from '../../service/active-component-registry.service';
import { ExternalAuthorityLookupService } from '../../service/external-authority-lookup.service';
import { TemplateTrustService } from '../../service/template-trust.service';
import { UserPreferencesService } from '../../service/user-preferences.service';
import { MessageHandlerService } from '../../service/message-handler.service';
import packageJson from 'package.json';
import { DOWNLOAD_ITEMS, DownloadItemId } from '../../models/ui/download-item.model';
import { downloadContentFor, downloadFilenameFor } from '../../util/download-content';
import { triggerDownload } from '../../util/trigger-download';
import { CEE_CONFIG_KEY, CeeConfig, configFlag } from '../../util/config-reader';
import { RenderSchedulerService } from '../../service/render-scheduler.service';
import { WidgetConfigCoordinator } from '../../util/widget-config-coordinator';

@Component({
  selector: 'app-cedar-embeddable-metadata-editor',
  templateUrl: './cedar-embeddable-metadata-editor.component.html',
  styleUrls: ['./cedar-embeddable-metadata-editor.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarEmbeddableMetadataEditorComponent implements OnDestroy {
  private static INNER_VERSION = '2026-09-11 17:52 c0b306d5';

  dataContext: DataContext | null = null;
  handlerContext: HandlerContext | null = null;

  pageBreakPaginatorService: PageBreakPaginatorService | null = null;

  /**
   * Whether the download menu exists.
   *
   * One key where there were sixteen: eight `show…` panels and their eight
   * `expanded…` partners, each rendering a dump under the form. The host decides
   * whether the menu is offered; what it offers is fixed.
   */
  showDownloadMenu = false;

  /**
   * Whether Expand All and Collapse All are offered.
   *
   * Defaults to true, which is how CEE has always rendered: a host turns them off
   * rather than having to ask for them.
   */
  showExpandCollapseAll = true;

  showTemplateDescription: boolean = false;
  readOnlyMode: boolean = false;

  /**
   * Whether every value on screen is one the template declared rather than one an instance recorded.
   *
   * With no instance behind the form, a control holds a value only because a default put it there —
   * a list arrives pre-selected, a term field pre-filled. Shown in the 0.87 black of recorded data it
   * claims to be an answer; in the 0.54 of a placeholder it sits at the weight of the specification
   * beside it, which names it as the default it is.
   */
  get declaredValuesOnly(): boolean {
    return this.readOnlyMode && this.handlerContext !== null && !this.handlerContext.instanceSupplied;
  }

  /**
   * Where the bridge server is, which only the host knows.
   *
   * No default, because every candidate is wrong somewhere: this held a `.orgx`
   * hostname for a year, which resolved nowhere outside the machine it was
   * written on, and then the production bridge, which a `.orgx` stack reached
   * without asking. Unset means the lookups are off and CEE says so, rather than
   * a deployment quietly talking to another one.
   */
  bridgeBaseUrl: string | null = null;

  allExpanded = true;
  ceeVersion: string;

  private readonly widgetConfig: WidgetConfigCoordinator;

  /**
   * The template's own version and where it is in its lifecycle, which the header states beside its
   * name.
   *
   * Not CEE's version, which is the stamp under the logo and says nothing about the artifact on
   * screen. A reader looking at a form wants to know which revision of the template produced it and
   * whether that revision is settled: a draft can still change under them, a published one cannot.
   * Both come from the parsed artifact — `pav:version` and `bibo:status` — so a template that
   * declares neither states nothing rather than guessing.
   */
  get templateVersion(): string | null {
    return this.parsedTemplate()?.pav_version?.getValue() ?? null;
  }

  get templateStatus(): string | null {
    return this.parsedTemplate()?.bibo_status?.getYamlValue() ?? null;
  }

  private parsedTemplate(): Template | null {
    const representation = this.dataContext?.templateRepresentation;
    return representation instanceof CedarTemplate ? representation.parsed : null;
  }

  constructor(
    private activeComponentRegistry: ActiveComponentRegistryService,
    private externalAuthorityLookupService: ExternalAuthorityLookupService,
    private messageHandlerService: MessageHandlerService,
    private templateTrustService: TemplateTrustService,
    private userPreferencesService: UserPreferencesService,
    private renderScheduler: RenderSchedulerService,
  ) {
    this.widgetConfig = new WidgetConfigCoordinator(
      this.externalAuthorityLookupService,
      this.templateTrustService,
      this.userPreferencesService,
    );
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
      handlerContext === null
        ? null
        : new PageBreakPaginatorService(this.activeComponentRegistry, handlerContext, this.renderScheduler);
    const representation = handlerContext?.dataContext.templateRepresentation;
    if (representation !== null && representation !== undefined) {
      this.pageBreakPaginatorService?.reset(representation.pageBreakChildren);
    }
  }

  @Input() set config(value: CeeConfig | null) {
    if (value != null) {
      this.showDownloadMenu = configFlag(value, CEE_CONFIG_KEY.showDownloadMenu, this.showDownloadMenu);
      this.showExpandCollapseAll = configFlag(value, CEE_CONFIG_KEY.showExpandCollapseAll, this.showExpandCollapseAll);
      this.showTemplateDescription = configFlag(
        value,
        CEE_CONFIG_KEY.showTemplateDescription,
        this.showTemplateDescription,
      );

      /*
       * The three settings the widgets themselves read, applied by the coordinator the
       * `cedar-embeddable-field` element applies too. A setting handled here alone would work in a
       * form and not in a lone field.
       */
      const widgets = this.widgetConfig.apply(value, this.readOnlyMode);
      this.bridgeBaseUrl = widgets.bridgeBaseUrl;
      this.readOnlyMode = widgets.readOnlyMode;
    }
  }

  /** A completed wrapper transaction is ready to render; parsing is already done. */
  @Input() set artifactRevision(revision: number) {
    if (revision <= 0 || this.handlerContext === null || this.dataContext === null) {
      return;
    }
    this.scheduleRender(`artifact revision ${revision}`);
  }

  /** Push the accepted model to widgets after Angular renders that model. */
  private scheduleRender(input: string): void {
    void this.renderScheduler
      .schedule(() => this.syncRenderedInstance())
      .then((rendered) => {
        if (rendered) {
          this.messageHandlerService.ready();
        }
      })
      .catch((error) => this.reportArtifactError(input, error));
  }

  private reportArtifactError(input: string, error: unknown): void {
    const detail = error instanceof Error ? error.message : String(error);
    this.messageHandlerService.error(`CEDAR Embeddable Editor: "${input}" could not be loaded: ${detail}`);
  }

  private syncRenderedInstance(): void {
    const representation = this.dataContext?.templateRepresentation;
    const handlerContext = this.handlerContext;
    if (representation == null || representation.children == null || handlerContext == null) {
      return;
    }
    for (const childComponent of representation.children) {
      this.activeComponentRegistry.updateViewToModel(childComponent, handlerContext);
    }
  }

  dataAvailableForRender(): boolean {
    return (
      this.dataContext != null &&
      this.dataContext.templateRepresentation != null &&
      !(this.dataContext.templateRepresentation instanceof NullTemplate) &&
      this.handlerContext != null &&
      this.handlerContext.multiInstanceObjectService.isInitialized()
    );
  }

  openAll(): void {
    this.allExpanded = true;
  }

  closeAll(): void {
    this.allExpanded = false;
  }
}
