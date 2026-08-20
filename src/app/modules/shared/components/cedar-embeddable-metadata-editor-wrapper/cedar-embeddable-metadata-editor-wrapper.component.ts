import {
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ControlledFieldDataService, INTEGRATED_SEARCH_PATH } from '../../service/controlled-field-data.service';
import { MessageHandlerService } from '../../service/message-handler.service';
import { CeeEventHandler, CeeJsonObject, CeeTemplateAndInstance } from '../../../../cee-public-api';
import { Subject } from 'rxjs';
import { HandlerContext } from '../../util/handler-context';
import { InstanceSerializer } from '../../util/instance-serializer';
import { ActiveComponentRegistryService } from '../../service/active-component-registry.service';
import { TranslateLoader, TranslateService, USE_DEFAULT_LANG, USE_STORE } from '@ngx-translate/core';
import { CedarEmbeddableMetadataEditorComponent } from '../cedar-embeddable-metadata-editor/cedar-embeddable-metadata-editor.component';
import { DataContext } from '../../util/data-context';
import { HttpClient } from '@angular/common/http';
import { GlobalSettingsContextService } from '../../service/global-settings-context.service';
import { ExternalAuthorityLookupService } from '../../service/external-authority-lookup.service';
import { UserPreferencesService } from '../../service/user-preferences.service';
import { FallbackTranslateLoaderFactory } from '../../util/fallback-translate-loader-factory';
import { TranslationMap } from '../../util/fallback-translate-loader';
import * as fallbackMapEN from '../../../../../assets/i18n-cee/en.json';
import * as fallbackMapHU from '../../../../../assets/i18n-cee/hu.json';
import { Overlay, OverlayContainer, OverlayPositionBuilder } from '@angular/cdk/overlay';
import { CedarOverlayContainer } from '../../service/cedar-overlay-container.service';
import { AriaDescriber } from '@angular/cdk/a11y';
import { CedarAriaDescriber } from '../../service/cedar-aria-describer.service';
import { baseUrl, CeeConfig, configFlag, configText } from '../../util/config-reader';
import { checkCeeConfig } from '../../util/config-validation';
import { Template, TemplateInstance } from 'cedar-model-typescript-library';
import { CedarTemplate } from '../../models/template/cedar-template.model';
import { InstanceDeserializer } from '../../util/instance-deserializer';
import { RenderSchedulerService } from '../../service/render-scheduler.service';

/**
 * One half of what an artifact input can supply.
 *
 * Two, rather than one claim per input, because the inputs overlap:
 * `templateAndInstanceObject` supplies what `templateObject` and `instanceObject`
 * supply between them, so a seal per input would let a host set the template
 * twice through two different names.
 */
type ArtifactClaim = 'template' | 'instance';

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
  innerConfig: CeeConfig | null = null;
  private initialized = false;
  private configSet = false;
  /** A supplied instance failed before it could become editor state. */
  private instanceInputRejected = false;

  /**
   * Which artifact a host has already supplied and CEE has accepted.
   *
   * Every input on this element takes one assignment and keeps it. Before, the
   * element only ever accumulated state: a second `config` patched the first for
   * most keys and replaced it for `outputSerialization`, and three inputs could
   * each supply an artifact with nothing saying which won. Neither lets a host
   * say "here is what I want now" instead of "here is one more thing on top of
   * whatever you already have", so a host could not return the editor to a known
   * state, and the same assignments in a different order gave a different editor.
   *
   * A host wanting different configuration or a different accepted artifact creates
   * a new element. An unreadable instance spends nothing and can be corrected.
   * `templateAndInstanceObject` spends both claims, which is what makes it exclusive
   * with the two separate inputs rather than merely redundant.
   */
  private readonly claimed = new Set<ArtifactClaim>();

  templateJson: CeeJsonObject | null = null;
  instanceJson: CeeJsonObject | null = null;
  templateAndInstanceJson: CeeTemplateAndInstance | null = null;
  protected onDestroySubject = new Subject<void>();
  private loadedTemplateJson: CeeJsonObject | null = null;
  private loadedMetadata: CeeJsonObject | null = null;

  // Constructor-assigned, so no `= null` placeholder: unlike the editor's, which
  // arrive through @Input setters and really can be unset, these two exist from
  // the moment the wrapper does.
  readonly dataContext: DataContext;
  readonly handlerContext: HandlerContext;

  private defaultLanguage = GlobalSettingsContextService.DEFAULT_LANGUAGE;
  private fallbackLanguage = GlobalSettingsContextService.DEFAULT_LANGUAGE;

  constructor(
    private readonly wrapper: ElementRef<HTMLElement>,
    private controlledFieldDataService: ControlledFieldDataService,
    private messageHandlerService: MessageHandlerService,
    private activeComponentRegistry: ActiveComponentRegistryService,
    private translateService: TranslateService,
    private globalSettingsContextService: GlobalSettingsContextService,
  ) {
    this.dataContext = new DataContext();
    this.handlerContext = new HandlerContext(this.dataContext, this.messageHandlerService);
  }

  /** Re-publishes CEE's existing change contract across the shadow boundary. */
  forwardChange(event: Event): void {
    if (event.composed) {
      return;
    }
    this.wrapper.nativeElement.dispatchEvent(
      new CustomEvent('change', {
        detail: event instanceof CustomEvent ? event.detail : undefined,
        bubbles: true,
        composed: true,
      }),
    );
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
    if (this.handlerContext) {
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
    if (this.handlerContext) {
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
    if (template == null || !this.claimAvailable('templateObject', ['template'])) {
      return;
    }
    this.commitClaim(['template']);
    this.applyTemplate(template);
  }

  /** An existing instance to load. Takes one assignment. */
  @Input() set instanceObject(instance: CeeJsonObject | null) {
    if (instance == null || !this.claimAvailable('instanceObject', ['instance'])) {
      return;
    }
    const parsed = this.readInstance('instanceObject', instance);
    if (parsed === null) {
      this.instanceInputRejected = true;
      return;
    }
    this.instanceInputRejected = false;
    this.commitClaim(['instance']);
    this.applyInstance(instance, parsed);
  }

  /** Both at once. Spends the template claim and the instance claim together. */
  @Input() set templateAndInstanceObject(templateAndInstance: CeeTemplateAndInstance | null) {
    if (templateAndInstance == null || !this.claimAvailable('templateAndInstanceObject', ['template', 'instance'])) {
      return;
    }
    const { templateObject, instanceObject } = templateAndInstance;
    if (!this.isJsonObject(templateObject)) {
      this.messageHandlerService.error('Template Object is missing.');
      return;
    }
    if (!this.isJsonObject(instanceObject)) {
      this.messageHandlerService.error('Instance Object is missing.');
      return;
    }
    const parsed = this.readInstance('templateAndInstanceObject.instanceObject', instanceObject);
    if (parsed === null) {
      this.instanceInputRejected = true;
      return;
    }
    this.instanceInputRejected = false;
    this.commitClaim(['template', 'instance']);
    this.applyTemplateAndInstance(templateAndInstance, parsed);
  }

  /**
   * Checks that an input is still available, or reports that it is not.
   *
   * A successful parse commits the claim separately. Reported and ignored rather
   * than thrown when already claimed: the setter runs inside a custom
   * element, so an exception would surface in the host's own call stack and could
   * break a code path with nothing to do with CEE. Silence was the other option
   * and is worse: a host debugging why its second assignment did nothing would
   * get no help at all.
   */
  private claimAvailable(input: string, parts: readonly ArtifactClaim[]): boolean {
    const spent = parts.filter((part) => this.claimed.has(part));
    if (spent.length > 0) {
      const subject = spent.length > 1 ? 'template and instance are' : `${spent[0]} is`;
      this.messageHandlerService.error(
        `CEDAR Embeddable Editor: "${input}" ignored, because the ${subject} already set. Each input takes ` +
          'one assignment; create a new editor element to load a different artifact.',
      );
      return false;
    }
    return true;
  }

  private commitClaim(parts: readonly ArtifactClaim[]): void {
    for (const part of parts) {
      this.claimed.add(part);
    }
  }

  private isJsonObject(value: unknown): value is CeeJsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  /** Parse before committing the set-once claim, so a rejected value can be corrected. */
  private readInstance(input: string, instance: CeeJsonObject): TemplateInstance | null {
    try {
      return InstanceDeserializer.read(instance, (message) => this.messageHandlerService.error(message)).full;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.messageHandlerService.error(
        `CEDAR Embeddable Editor: "${input}" rejected because it is not a readable CEDAR instance: ${detail}`,
      );
      return null;
    }
  }

  /*
   * The write, separated from the claim that guards it.
   *
   * The sample-template loader reaches these directly. It is CEE's own developer
   * feature and loads a different sample on every click, which is exactly the
   * reassignment a host may not perform — and it is internal, so the contract
   * about what a host may do does not bind it.
   */
  private applyTemplate(template: CeeJsonObject): void {
    this.templateJson = template;
    // The template can be the last thing to arrive, and now renders without a
    // config, so it is one of the three things that can complete the picture.
    this.doInitialize();
  }

  private applyInstance(instance: CeeJsonObject, parsed?: TemplateInstance): void {
    const accepted = parsed ?? this.readInstance('sample instance', instance);
    if (accepted === null) {
      this.instanceInputRejected = true;
      return;
    }
    this.instanceInputRejected = false;
    this.dataContext.instanceFullData = accepted;
    this.dataContext.invalidateDerivedViews();
    this.instanceJson = instance;
    this.handlerContext.instanceSupplied = true;
    this.doInitialize();
  }

  private applyTemplateAndInstance(templateAndInstance: CeeTemplateAndInstance, parsed?: TemplateInstance): void {
    const accepted = parsed ?? this.readInstance('sample instance', templateAndInstance.instanceObject);
    if (accepted === null) {
      this.instanceInputRejected = true;
      return;
    }
    this.instanceInputRejected = false;
    this.dataContext.instanceFullData = accepted;
    this.dataContext.invalidateDerivedViews();
    this.templateAndInstanceJson = templateAndInstance;
    this.handlerContext.instanceSupplied = true;
    this.doInitialize();
  }

  @Input() get dataQualityReport(): object {
    if (this.handlerContext) {
      return JSON.parse(JSON.stringify(this.handlerContext.dataContext.dataQualityReport));
    }
    return {};
  }

  ngOnDestroy(): void {
    this.onDestroySubject.next();
    this.onDestroySubject.complete();
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
    if (value == null) {
      return;
    }
    if (this.configSet) {
      this.messageHandlerService.error(
        'CEDAR Embeddable Editor: "config" ignored, because the editor is already configured. Configuration ' +
          'takes one assignment; create a new editor element to configure it differently.',
      );
      return;
    }
    this.messageHandlerService.trace('CEDAR Embeddable Editor config set to:' + JSON.stringify(value));

    /*
     * Reported *and* refused, which for a while it was only the first of. What the
     * host is told and what CEE stores come from the same pass, so a key called
     * ignored is a key nothing reads — where before the message said "Ignored." and
     * the reader coerced the value: `readOnlyMode: 'false'` locked the form.
     */
    const { problems, usable } = checkCeeConfig(value);
    for (const problem of problems) {
      this.messageHandlerService.error(problem);
    }

    /*
     * Nothing that is not a configuration spends the one assignment there is. A host
     * that handed over a string has said nothing yet, and used to be left with an
     * element it could never configure — the next, correct assignment was refused as
     * a second one. An object counts however little of it survives: a configuration
     * whose every key was refused still asks for the defaults, which is what `{}`
     * asks for, and the two must not differ in what a host may do next.
     */
    if (usable === null) {
      return;
    }

    this.innerConfig = usable;
    this.configSet = true;
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
    if (!this.initialized || (!this.configSet && !this.editorDataReady())) {
      return;
    }
    // Where the language map came from, and which languages had been loaded from
    // there, before this configuration has its say. Both are read at the end, to
    // tell a first installation from a host moving the map under an editor that has
    // already rendered. `getLangs` hands back its own array, so this copies it.
    const previousPathPrefix = this.globalSettingsContextService.languageMapPathPrefix;
    const languagesLoadedBefore = [...this.translateService.getLangs()];
    /*
     * A host that sets nothing is a host that wants every default, so no
     * configuration reads as the empty one.
     *
     * This used to return unless `config` had been assigned, which left the
     * translation service uninitialized and — with `editorDataReady` also
     * requiring a config — meant an element given a template and nothing else
     * never rendered at all. Every key on `CeeConfig` is optional and documents a
     * default, so `{}` and "not assigned" have to mean the same thing.
     *
     * Each `Object.hasOwn` below is then false, and each else-branch traces the
     * default it fell back to, which is what a host reading the console needs.
     */
    const config = this.innerConfig ?? {};
    /*
     * The terminology server's base, with CEE appending the path it knows —
     * the same shape `bridgeBaseUrl` takes in the editor component.
     *
     * The key used to carry the endpoint whole, so every host spelled out
     * `bioportal/integrated-search`: the terminology server's own route,
     * restated in four deployment configs. Unset, nothing is installed and the
     * service reports that controlled-term search is off.
     */
    const terminologyBaseUrl = baseUrl(config, CedarEmbeddableMetadataEditorComponent.TERMINOLOGY_BASE_URL);
    if (terminologyBaseUrl !== null) {
      this.controlledFieldDataService.setIntegratedSearchUrl(terminologyBaseUrl + INTEGRATED_SEARCH_PATH);
    }
    if (Object.hasOwn(config, CedarEmbeddableMetadataEditorComponent.LANGUAGE_MAP_PATH_PREFIX)) {
      const languageMapPathPrefix = configText(
        config,
        CedarEmbeddableMetadataEditorComponent.LANGUAGE_MAP_PATH_PREFIX,
        '',
      );
      this.globalSettingsContextService.languageMapPathPrefix = languageMapPathPrefix;
    }
    if (Object.hasOwn(config, CedarEmbeddableMetadataEditorComponent.FALLBACK_LANGUAGE)) {
      this.fallbackLanguage = configText(
        config,
        CedarEmbeddableMetadataEditorComponent.FALLBACK_LANGUAGE,
        this.fallbackLanguage,
      );
    } else {
      this.messageHandlerService.traceGroup(
        'language',
        '"fallbackLanguage" not set, using default: "' + this.fallbackLanguage + '"',
      );
    }
    if (Object.hasOwn(config, CedarEmbeddableMetadataEditorComponent.DEFAULT_LANGUAGE)) {
      this.defaultLanguage = configText(
        config,
        CedarEmbeddableMetadataEditorComponent.DEFAULT_LANGUAGE,
        this.defaultLanguage,
      );
    } else {
      this.messageHandlerService.traceGroup(
        'language',
        '"defaultLanguage" not set, using default: "' + this.defaultLanguage + '"',
      );
    }
    if (Object.hasOwn(config, CedarEmbeddableMetadataEditorComponent.READ_ONLY_MODE)) {
      const mode = configFlag(config, CedarEmbeddableMetadataEditorComponent.READ_ONLY_MODE, false);
      if (mode) {
        this.handlerContext.enableReadOnlyMode();
      }
    }
    this.translateService.setDefaultLang(this.fallbackLanguage);
    this.translateService.use(this.defaultLanguage);
    this.reloadLanguageMapsIfSourceMoved(previousPathPrefix, languagesLoadedBefore);
  }

  /**
   * Fetch the language maps again when the host changed where they come from.
   *
   * `use()` above is what installs a language, and it is where a late
   * `languageMapPathPrefix` used to be lost. ngx-translate guards the work twice:
   * `use()` returns immediately when the language asked for is already current, and
   * behind that `retrieveTranslations` consults the loader only when it holds no map
   * for the language. A host that renders a template first and configures second
   * hits both — the built-in map is already loaded under `en`, the late config names
   * `en` again, and the new prefix reaches a loader nothing calls. Measured against
   * the shipped bundle before this repair: no request for the external map at all,
   * and every built-in label left standing.
   *
   * Getting past both guards takes `reloadLang`, which drops the cached map and the
   * memoised request and then goes back to the loader. That alone would leave the
   * editor showing the old text, because the fetch stores its result without
   * announcing it. `setTranslation` is the one method that emits
   * `onTranslationChange`, which is what the rendered pipes subscribe to. Hence the
   * pair.
   *
   * Only the maps that predate this call are reloaded, which is what keeps the
   * ordinary paths free of a second fetch: a first configuration finds nothing
   * loaded, and a configuration naming a *different* language gets that one past
   * both guards on its own. A map left over from the old source is reloaded whether
   * it is the current language or the fallback, since the fallback answers the keys
   * the current language is missing and a half-migrated pair would serve some labels
   * from each source.
   */
  private reloadLanguageMapsIfSourceMoved(previousPathPrefix: string | null, languagesLoadedBefore: string[]): void {
    if (this.globalSettingsContextService.languageMapPathPrefix === previousPathPrefix) {
      return;
    }
    for (const language of languagesLoadedBefore) {
      this.translateService
        .reloadLang(language)
        .subscribe((translations: TranslationMap) => this.translateService.setTranslation(language, translations));
    }
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
    return !this.instanceInputRejected && (this.templateJson != null || this.templateAndInstanceJson != null);
  }

  private triggerUpdateOnInjectedSampleData(): void {
    if (this.loadedTemplateJson != null && this.loadedMetadata != null) {
      this.applyTemplateAndInstance({
        templateObject: this.loadedTemplateJson,
        instanceObject: this.loadedMetadata,
      });
      return;
    }
    if (this.loadedTemplateJson != null) {
      this.handlerContext.dataContext.instanceFullData = null;
      this.handlerContext.dataContext.invalidateDerivedViews();
      this.applyTemplate(this.loadedTemplateJson);
    }
    if (this.loadedMetadata !== null) {
      this.applyInstance(this.loadedMetadata);
    }
  }
}
