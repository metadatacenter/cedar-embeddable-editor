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
import { CeeEventHandler } from '../../../../cee-public-api';
import { Subject } from 'rxjs';
import { SampleTemplatesService } from '../sample-templates/sample-templates.service';
import { map, takeUntil, withLatestFrom } from 'rxjs/operators';
import { HandlerContext } from '../../util/handler-context';
import { InstanceSerializer } from '../../util/instance-serializer';
import { ActiveComponentRegistryService } from '../../service/active-component-registry.service';
import { TranslateLoader, TranslateService, USE_DEFAULT_LANG, USE_STORE } from '@ngx-translate/core';
import { CedarEmbeddableMetadataEditorComponent } from '../cedar-embeddable-metadata-editor/cedar-embeddable-metadata-editor.component';
import { DataContext } from '../../util/data-context';
import { HttpClient, HttpStatusCode } from '@angular/common/http';
import { GlobalSettingsContextService } from '../../service/global-settings-context.service';
import { ExternalAuthorityLookupService } from '../../service/external-authority-lookup.service';
import { UserPreferencesService } from '../../service/user-preferences.service';
import { IriPrefix } from '../../util/iri-prefix';
import { FallbackTranslateLoaderFactory } from '../../util/fallback-translate-loader-factory';
import * as fallbackMapEN from '../../../../../assets/i18n-cee/en.json';
import * as fallbackMapHU from '../../../../../assets/i18n-cee/hu.json';
import { Overlay, OverlayContainer, OverlayPositionBuilder } from '@angular/cdk/overlay';
import { CedarOverlayContainer } from '../../service/cedar-overlay-container.service';
import { AriaDescriber } from '@angular/cdk/a11y';
import { CedarAriaDescriber } from '../../service/cedar-aria-describer.service';
import { SampleTemplateLoaderOwner } from '../../models/ui/sample-template-loader-owner.model';
import { CeeConfig, configFlag, configText } from '../../util/config-reader';
import { validateCeeConfig } from '../../util/config-validation';
import { InstanceObject } from '../../models/instance-node.model';

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
    { provide: IriPrefix, useFactory: () => new IriPrefix() },
    MessageHandlerService,
    SampleTemplatesService,
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

  templateJson: InstanceObject | null = null;
  instanceJson: InstanceObject | null = null;
  templateAndInstanceJson: object | null = null;
  sampleTemplateLoaderObject: SampleTemplateLoaderOwner | null = null;
  showSpinnerBeforeInit = true;
  protected onDestroySubject = new Subject<void>();
  private loadedTemplateJson: InstanceObject | null = null;
  private loadedMetadata: InstanceObject | null = null;

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
    private sampleTemplateService: SampleTemplatesService,
    private activeComponentRegistry: ActiveComponentRegistryService,
    private translateService: TranslateService,
    private messagingService: MessageHandlerService,
    private globalSettingsContextService: GlobalSettingsContextService,
    private iriPrefix: IriPrefix,
  ) {
    this.sampleTemplateLoaderObject = this;
    this.dataContext = new DataContext();
    this.handlerContext = new HandlerContext(this.dataContext, this.messagingService, () => this.iriPrefix.get());
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
    const { templateJson$, metadataJson$ } = this.sampleTemplateService;

    const metadataAndTemplate = metadataJson$.pipe(
      withLatestFrom(templateJson$),
      map(([metadataJson, templateJson]) => {
        return { metadataJson, templateJson };
      }),
      takeUntil(this.onDestroySubject),
    );

    metadataAndTemplate.subscribe((values) => {
      const { templateJson: templateByNum, metadataJson: metadataByNum } = values;
      if (templateByNum && metadataByNum) {
        // Separate bindings rather than reassigning the same two: what arrives is a
        // `{ templateNum: artifact }` map, and what is wanted is the artifact inside
        // it. The old code put both through one name and the types disagreed.
        const templateJson = Object.values(templateByNum)[0];
        const metadataJson = Object.values(metadataByNum)[0];
        if (templateJson && metadataJson) {
          this.loadedTemplateJson = templateJson;
          this.loadedMetadata = metadataJson;
        } else if (templateJson) {
          this.loadedTemplateJson = templateJson;
          this.loadedMetadata = null;
        } else if (metadataJson) {
          this.loadedMetadata = metadataJson;
        } else {
          this.templateJson = null;
          this.loadedMetadata = null;
        }
        this.triggerUpdateOnInjectedSampleData();
      }
    });
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
      return InstanceSerializer.toJson(this.handlerContext.dataContext.instanceFullData);
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
      return InstanceSerializer.toYaml(this.handlerContext.dataContext.instanceFullData);
    }
    return '';
  }

  /**
   * The instance in whichever serialization the config selected — a JSON object
   * by default, or a YAML string when `outputSerialization: 'yaml'` is set.
   *
   * The typed getters above stay for a host that always wants one or the other;
   * this is for a host that configures the format once and reads a single
   * accessor. Output serialization is independent of input: the template can be
   * handed in as JSON and the instance asked for as YAML.
   */
  @Input() get currentMetadataSerialized(): object | string {
    if (!this.handlerContext) {
      return this.isYamlOutput() ? '' : {};
    }
    const instance = this.handlerContext.dataContext.instanceFullData;
    return this.isYamlOutput() ? InstanceSerializer.toYaml(instance) : InstanceSerializer.toJson(instance);
  }

  private isYamlOutput(): boolean {
    return (
      this.innerConfig != null &&
      this.innerConfig[CedarEmbeddableMetadataEditorComponent.OUTPUT_SERIALIZATION] ===
        CedarEmbeddableMetadataEditorComponent.SERIALIZATION_YAML
    );
  }

  @Input() set templateObject(template: InstanceObject) {
    this.templateJson = template;
  }

  @Input() set instanceObject(instance: InstanceObject) {
    this.instanceJson = instance;
  }

  @Input() set templateAndInstanceObject(templateAndInstance: object) {
    this.templateAndInstanceJson = templateAndInstance;
  }

  @Input() get dataQualityReport(): object {
    if (this.handlerContext) {
      return JSON.parse(JSON.stringify(this.handlerContext.dataContext.dataQualityReport));
    }
    return {};
  }

  // TODO: revisit if this method is needed. The CEE should be agnostic of the environment, should expect the config to be injected
  @Input() loadConfigFromURL(
    jsonURL: string,
    successHandler: ((config: unknown) => void) | null = null,
    errorHandler: ((request: XMLHttpRequest) => void) | null = null,
  ): void {
    const xhr = new XMLHttpRequest();
    xhr.onreadystatechange = () => {
      if (xhr.readyState === XMLHttpRequest.DONE) {
        if (xhr.status === HttpStatusCode.Ok) {
          /**
           * A 200 is not a promise of JSON.
           *
           * A misconfigured path, a login redirect or a proxy notice all answer 200 with
           * HTML, and `JSON.parse` used to throw here — inside an XHR callback, so the
           * exception went nowhere and *neither* handler was called. The host was told
           * nothing and could not tell that from a request still in flight.
           *
           * A body that will not parse is a failure to load a config, which is what the
           * error handler is for.
           */
          let jsonConfig = null;
          try {
            jsonConfig = JSON.parse(xhr.responseText);
          } catch (e) {
            /**
             * Reported straight to the console, not through `MessageHandlerService`.
             *
             * When a host page calls this on the custom element, `this` is the element
             * rather than this component: `that.config = ...` works because Angular
             * Elements forwards it as an `@Input`, but injected services are not on the
             * element and `that.messageHandlerService` is `undefined`. Reaching for it
             * here threw, which is a worse failure than the one being handled.
             */
            console.error('CEE ERROR: config at ' + jsonURL + ' is not JSON: ' + e);
            if (errorHandler) {
              errorHandler(xhr);
            }
            return;
          }
          this.config = jsonConfig;

          if (successHandler) {
            successHandler(jsonConfig);
          }
        } else {
          if (errorHandler) {
            errorHandler(xhr);
          }
        }
      }
    };
    xhr.open('GET', jsonURL, true);
    xhr.send();
  }

  ngOnDestroy(): void {
    this.onDestroySubject.next();
    this.onDestroySubject.complete();
    this.activeComponentRegistry.clear();
  }

  @Input() set config(value: CeeConfig) {
    this.messageHandlerService.trace('CEDAR Embeddable Editor config set to:' + JSON.stringify(value));

    /*
     * Both ways in converge here: a host assigning `config`, and `loadConfigFromURL`
     * assigning it after parsing. That matters, because the fetched one is the
     * configuration nothing has type-checked — the shipped declarations catch a
     * misspelled key for a TypeScript host writing a literal, and can say nothing
     * about JSON off a URL.
     *
     * Reported, not rejected. A bad key is ignored downstream exactly as before;
     * the change is that the host is told rather than left watching a setting do
     * nothing.
     */
    for (const problem of validateCeeConfig(value)) {
      this.messageHandlerService.error(problem);
    }

    if (value != null) {
      this.innerConfig = value;
      this.configSet = true;
      this.doInitialize();
    }
  }

  @Input() set eventHandler(value: CeeEventHandler) {
    this.messageHandlerService.injectEventHandler(value);
  }

  private doInitialize(): void {
    // Narrowed once. Every read below went through `this.innerConfig`, which is
    // nullable until a host sets it, so each of the sixteen would otherwise have
    // to restate that. `configSet` already implies it is there; this makes the
    // implication something the compiler can see.
    const config = this.innerConfig;
    if (!this.initialized || !this.configSet || config === null) {
      return;
    }
    if (Object.hasOwn(config, CedarEmbeddableMetadataEditorComponent.LOAD_SAMPLE_TEMPLATE_NAME)) {
      this.sampleTemplateService.loadTemplate(
        configText(config, CedarEmbeddableMetadataEditorComponent.TEMPLATE_LOCATION_PREFIX, ''),
        configText(config, CedarEmbeddableMetadataEditorComponent.LOAD_SAMPLE_TEMPLATE_NAME, ''),
      );
    }
    if (Object.hasOwn(config, CedarEmbeddableMetadataEditorComponent.TERMINOLOGY_INTEGRATED_SEARCH_URL)) {
      const integratedSearchUrl = configText(
        config,
        CedarEmbeddableMetadataEditorComponent.TERMINOLOGY_INTEGRATED_SEARCH_URL,
        '',
      );
      this.controlledFieldDataService.setTerminologyIntegratedSearchUrl(integratedSearchUrl);
    }
    if (Object.hasOwn(config, CedarEmbeddableMetadataEditorComponent.SHOW_SPINNER_BEFORE_INIT)) {
      this.showSpinnerBeforeInit = configFlag(
        config,
        CedarEmbeddableMetadataEditorComponent.SHOW_SPINNER_BEFORE_INIT,
        this.showSpinnerBeforeInit,
      );
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
      this.messagingService.traceGroup(
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
      this.messagingService.traceGroup(
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
    if (Object.hasOwn(config, CedarEmbeddableMetadataEditorComponent.HIDE_EMPTY_FIELDS)) {
      // Hiding empty fields is only allowed in ReadOnly Mode
      const hideEmptyFields = configFlag(config, CedarEmbeddableMetadataEditorComponent.HIDE_EMPTY_FIELDS, false);
      if (this.handlerContext.readOnlyMode && hideEmptyFields) {
        this.handlerContext.enableEmptyFieldHiding();
      }
    }
    this.translateService.setDefaultLang(this.fallbackLanguage);
    this.translateService.use(this.defaultLanguage);
  }

  editorDataReady(): boolean {
    return this.innerConfig != null && (this.templateJson != null || this.templateAndInstanceJson != null);
  }

  private triggerUpdateOnInjectedSampleData(): void {
    if (this.loadedTemplateJson != null && this.loadedMetadata != null) {
      this.templateAndInstanceObject = {
        templateObject: this.loadedTemplateJson,
        instanceObject: this.loadedMetadata,
      };
      return;
    }
    if (this.loadedTemplateJson != null) {
      this.handlerContext.dataContext.instanceFullData = null;
      this.handlerContext.dataContext.invalidateDerivedViews();
      this.templateObject = this.loadedTemplateJson;
    }
    if (this.loadedMetadata !== null) {
      this.instanceObject = this.loadedMetadata;
    }
  }
}
