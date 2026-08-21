import {
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ControlledFieldDataService } from '../../service/controlled-field-data.service';
import { MessageHandlerService } from '../../service/message-handler.service';
import {
  CeeChangeDetail,
  CeeDataQualityReport,
  CeeEventHandler,
  CeeJsonObject,
  CeeTemplateAndInstance,
} from '../../../../cee-public-api';
import { HandlerContext, InstanceMutation } from '../../util/handler-context';
import { InstanceSerializer } from '../../util/instance-serializer';
import { ActiveComponentRegistryService } from '../../service/active-component-registry.service';
import { TranslateLoader, TranslateService, USE_DEFAULT_LANG, USE_STORE } from '@ngx-translate/core';
import { DataContext } from '../../util/data-context';
import { HttpClient } from '@angular/common/http';
import { GlobalSettingsContextService } from '../../service/global-settings-context.service';
import { ExternalAuthorityLookupService } from '../../service/external-authority-lookup.service';
import { UserPreferencesService } from '../../service/user-preferences.service';
import { FallbackTranslateLoaderFactory } from '../../util/fallback-translate-loader-factory';
import * as fallbackMapEN from '../../../../../assets/i18n-cee/en.json';
import * as fallbackMapHU from '../../../../../assets/i18n-cee/hu.json';
import { Overlay, OverlayContainer, OverlayPositionBuilder } from '@angular/cdk/overlay';
import { CedarOverlayContainer } from '../../service/cedar-overlay-container.service';
import { AriaDescriber } from '@angular/cdk/a11y';
import { CedarAriaDescriber } from '../../service/cedar-aria-describer.service';
import { CeeConfig } from '../../util/config-reader';
import { Template } from 'cedar-model-typescript-library';
import { CedarTemplate } from '../../models/template/cedar-template.model';
import { RenderSchedulerService } from '../../service/render-scheduler.service';
import { ArtifactInputCoordinator } from '../../util/artifact-input-coordinator';
import { WrapperConfigCoordinator } from '../../util/wrapper-config-coordinator';

@Component({
  selector: 'app-cedar-embeddable-metadata-editor-wrapper',
  templateUrl: './cedar-embeddable-metadata-editor-wrapper.component.html',
  styleUrls: ['./cedar-embeddable-metadata-editor-wrapper.component.scss'],
  encapsulation: ViewEncapsulation.ShadowDom,
  providers: [
    { provide: AriaDescriber, useClass: CedarAriaDescriber },
    { provide: OverlayContainer, useClass: CedarOverlayContainer },
    OverlayPositionBuilder,
    Overlay,
    ActiveComponentRegistryService,
    ControlledFieldDataService,
    ExternalAuthorityLookupService,
    GlobalSettingsContextService,
    MessageHandlerService,
    RenderSchedulerService,
    UserPreferencesService,
    {
      provide: TranslateLoader,
      useFactory: (
        http: HttpClient,
        messageHandlerService: MessageHandlerService,
        globalSettingsContextService: GlobalSettingsContextService,
      ) =>
        FallbackTranslateLoaderFactory(http, messageHandlerService, globalSettingsContextService, {
          en: fallbackMapEN,
          hu: fallbackMapHU,
        }),
      deps: [HttpClient, MessageHandlerService, GlobalSettingsContextService],
    },
    { provide: USE_STORE, useValue: true },
    { provide: USE_DEFAULT_LANG, useValue: true },
    TranslateService,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarEmbeddableMetadataEditorWrapperComponent implements OnInit, OnDestroy {
  private initialized = false;
  private readonly artifacts: ArtifactInputCoordinator;
  private readonly configuration: WrapperConfigCoordinator;
  private lastPublishedMetadata = '';
  artifactRevision = 0;

  // Constructor-assigned, so no `= null` placeholder: unlike the editor's, which
  // arrive through @Input setters and really can be unset, these two exist from
  // the moment the wrapper does.
  dataContext: DataContext;
  handlerContext: HandlerContext;

  constructor(
    private readonly wrapper: ElementRef<HTMLElement>,
    private controlledFieldDataService: ControlledFieldDataService,
    private messageHandlerService: MessageHandlerService,
    private activeComponentRegistry: ActiveComponentRegistryService,
    private translateService: TranslateService,
    private globalSettingsContextService: GlobalSettingsContextService,
  ) {
    this.artifacts = new ArtifactInputCoordinator(this.messageHandlerService);
    this.configuration = new WrapperConfigCoordinator(
      this.controlledFieldDataService,
      this.messageHandlerService,
      this.translateService,
      this.globalSettingsContextService,
    );
    this.dataContext = this.artifacts.state.dataContext;
    this.handlerContext = this.artifacts.state.handlerContext;
  }

  get innerConfig(): CeeConfig | null {
    return this.configuration.config;
  }

  get templateJson(): CeeJsonObject | null {
    return this.artifacts.state.templateJson;
  }

  get instanceJson(): CeeJsonObject | null {
    return this.artifacts.state.instanceJson;
  }

  get templateAndInstanceJson(): CeeTemplateAndInstance | null {
    return this.artifacts.state.templateAndInstanceJson;
  }

  /** DOM control events are implementation traffic; model mutations publish the host contract. */
  suppressNativeChange(event: Event): void {
    event.stopPropagation();
  }

  ngOnInit(): void {
    this.initialized = true;
    this.doInitialize();
  }

  /**
   * The instance, as CEDAR JSON.
   *
   * Written by the CEDAR Model TypeScript Library rather than by CEE. The tree
   * CEE keeps while the form is open is its own working copy — the widgets
   * mutate it in place — but what leaves here is a CEDAR artifact, and what one
   * of those looks like is the model's business.
   */
  @Input() get currentMetadata(): object {
    if (!this.artifacts.instanceInputRejected) {
      return InstanceSerializer.toJson(this.handlerContext.dataContext.instanceFullData, this.parsedTemplate());
    }
    return {};
  }

  /**
   * The same instance, as CEDAR YAML.
   *
   * Free, once the instance is a model rather than a pile of JSON: a different
   * writer, not a different code path.
   */
  @Input() get currentMetadataYaml(): string {
    if (!this.artifacts.instanceInputRejected) {
      return InstanceSerializer.toYaml(this.handlerContext.dataContext.instanceFullData, this.parsedTemplate());
    }
    return '';
  }

  /**
   * The template as the library parsed it, for completing an instance on the way
   * out. Null before a template has been set, which the serializer allows for.
   */
  private parsedTemplate(): Template | null {
    const representation = this.handlerContext?.dataContext?.templateRepresentation;
    return representation instanceof CedarTemplate ? representation.parsed : null;
  }

  /**
   * The template to render.
   *
   * Takes one assignment. Either order works with `instanceObject`: the editor is
   * not built until a template is present, so an instance supplied first waits
   * rather than arriving early.
   */
  @Input() set templateObject(template: CeeJsonObject | null) {
    if (template === null || !this.artifacts.acceptTemplate(template)) {
      return;
    }
    this.installArtifactState();
  }

  /** An existing instance to load. Takes one assignment. */
  @Input() set instanceObject(instance: CeeJsonObject | null) {
    if (instance === null || !this.artifacts.acceptInstance(instance)) {
      return;
    }
    this.installArtifactState();
  }

  /** Both at once. Spends the template claim and the instance claim together. */
  @Input() set templateAndInstanceObject(templateAndInstance: CeeTemplateAndInstance | null) {
    if (templateAndInstance === null || !this.artifacts.acceptCombined(templateAndInstance)) {
      return;
    }
    this.installArtifactState();
  }

  private installArtifactState(): void {
    const state = this.artifacts.state;
    this.activeComponentRegistry.clear();
    this.dataContext = state.dataContext;
    this.handlerContext = state.handlerContext;
    this.handlerContext.setMutationListener((mutation) => this.publishMutation(mutation));
    this.artifactRevision = state.revision;
    this.lastPublishedMetadata = this.metadataKey();
    this.doInitialize();
  }

  private metadataKey(): string {
    return JSON.stringify(this.currentMetadata);
  }

  /** Publish only mutations whose serialized result differs from the previous result. */
  private publishMutation(mutation: InstanceMutation): void {
    const metadata = this.currentMetadata as CeeJsonObject;
    const key = JSON.stringify(metadata);
    if (key === this.lastPublishedMetadata) {
      return;
    }
    this.lastPublishedMetadata = key;

    const report = this.dataQualityReport as CeeDataQualityReport;
    const multiOperation = mutation.operation === 'valueChanged' ? undefined : mutation.operation;
    const detail: CeeChangeDetail = {
      operation: mutation.operation,
      path: [...mutation.path],
      value: mutation.value,
      validity: report.isValid === true,
      dataQualityReport: report,
      title: typeof metadata['schema:name'] === 'string' ? metadata['schema:name'] : null,
      description: typeof metadata['schema:description'] === 'string' ? metadata['schema:description'] : null,
      ...(multiOperation === undefined ? {} : { message: multiOperation }),
    };

    if (mutation.operation === 'valueChanged') {
      this.messageHandlerService.valueChanged(detail.path, detail.value);
    }
    this.wrapper.nativeElement.dispatchEvent(
      new CustomEvent<CeeChangeDetail>('change', { detail, bubbles: true, composed: true }),
    );
  }

  @Input() get dataQualityReport(): object {
    if (!this.artifacts.instanceInputRejected) {
      return JSON.parse(JSON.stringify(this.handlerContext.dataContext.dataQualityReport));
    }
    return {};
  }

  ngOnDestroy(): void {
    this.activeComponentRegistry.clear();
  }

  /**
   * The configuration, which takes one assignment and keeps it.
   *
   * A host wanting different settings creates a new element. That replaces two
   * behaviours no host could reason about: an omitted key kept whatever the
   * previous configuration installed, for the terminology endpoint, the IRI
   * prefix and both languages among others, while `outputSerialization` reset
   * instead — so what a missing key meant depended on which key it was.
   */
  @Input() set config(value: CeeConfig | null) {
    if (value === null || !this.configuration.accept(value)) {
      return;
    }
    this.doInitialize();
  }

  @Input() set eventHandler(value: CeeEventHandler) {
    this.messageHandlerService.injectEventHandler(value);
  }

  /**
   * Apply the configuration, once there is a reason to.
   *
   * Called from three places, because three things can be the last to arrive: the
   * component's own `ngOnInit`, a `config` assignment, and a template. Whichever
   * completes the picture does the work, and the guard below is what keeps the
   * others from doing it early or twice.
   *
   * "A reason to" means a host has said something — a configuration — or there is
   * an editor about to be rendered that needs the defaults installed. Neither yet,
   * and there is nothing to apply: settling on defaults at `ngOnInit` would install
   * a language a `config` arriving a moment later immediately replaces.
   *
   * A template followed by a `config` does run this twice, and has to: the editor
   * is rendered with the defaults and then reconfigured. That is visible only as a
   * second call to the translation service, and the settings a late config carries
   * reach already-built widgets through services they subscribe to.
   */
  private doInitialize(): void {
    if (!this.initialized || (!this.configuration.hasConfiguration && !this.editorDataReady())) {
      return;
    }
    this.configuration.apply(this.handlerContext);
  }

  /**
   * Whether there is something to render, which is a question about the artifact.
   *
   * A template. Configuration was required too, so an element assigned a template
   * and nothing else stayed blank for good: both getters answered empty — `{}` and
   * `''` — with no error, no warning and nothing in the console to connect the
   * blank frame to a key the host had not set. Since every key is optional and
   * documents a default, a host with nothing to say had no way to say it.
   */
  editorDataReady(): boolean {
    return !this.artifacts.instanceInputRejected && this.dataContext.templateRepresentation !== null;
  }
}
