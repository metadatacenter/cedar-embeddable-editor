import { Component, Input, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { ControlledFieldDataService } from '../../service/controlled-field-data.service';
import { MessageHandlerService } from '../../service/message-handler.service';
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

@Component({
  selector: 'app-cedar-embeddable-metadata-editor-wrapper',
  templateUrl: './cedar-embeddable-metadata-editor-wrapper.component.html',
  styleUrls: ['./cedar-embeddable-metadata-editor-wrapper.component.scss'],
  encapsulation: ViewEncapsulation.None,
  providers: [
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
})
export class CedarEmbeddableMetadataEditorWrapperComponent implements OnInit, OnDestroy {
  innerConfig: object = null;
  private initialized = false;
  private configSet = false;

  templateJson: object = null;
  instanceJson: object = null;
  templateAndInstanceJson: object = null;
  sampleTemplateLoaderObject = null;
  showSpinnerBeforeInit = true;
  protected onDestroySubject = new Subject<void>();
  private loadedTemplateJson: object = null;
  private loadedMetadata: object = null;

  readonly dataContext: DataContext = null;
  readonly handlerContext: HandlerContext = null;

  private defaultLanguage = GlobalSettingsContextService.DEFAULT_LANGUAGE;
  private fallbackLanguage = GlobalSettingsContextService.DEFAULT_LANGUAGE;

  @ViewChild(CedarEmbeddableMetadataEditorComponent) editorComponent: CedarEmbeddableMetadataEditorComponent;

  constructor(
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
      let { templateJson, metadataJson } = values;
      if (templateJson && metadataJson) {
        templateJson = Object.values(templateJson)[0];
        metadataJson = Object.values(metadataJson)[0];
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

  @Input() set templateObject(template: object) {
    this.templateJson = template;
  }

  @Input() set instanceObject(instance: object) {
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
  @Input() loadConfigFromURL(jsonURL, successHandler = null, errorHandler = null): void {
    const that = this;
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
          that.config = jsonConfig;

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
  }

  @Input() set config(value: object) {
    this.messageHandlerService.trace('CEDAR Embeddable Editor config set to:' + JSON.stringify(value));

    if (value != null) {
      this.innerConfig = value;
      this.configSet = true;
      this.doInitialize();
    }
  }

  @Input() set eventHandler(value: object) {
    this.messageHandlerService.injectEventHandler(value);
  }

  private doInitialize(): void {
    if (this.initialized && this.configSet) {
      if (Object.hasOwn(this.innerConfig, CedarEmbeddableMetadataEditorComponent.LOAD_SAMPLE_TEMPLATE_NAME)) {
        this.sampleTemplateService.loadTemplate(
          this.innerConfig[CedarEmbeddableMetadataEditorComponent.TEMPLATE_LOCATION_PREFIX],
          this.innerConfig[CedarEmbeddableMetadataEditorComponent.LOAD_SAMPLE_TEMPLATE_NAME],
        );
      }
      if (Object.hasOwn(this.innerConfig, CedarEmbeddableMetadataEditorComponent.TERMINOLOGY_INTEGRATED_SEARCH_URL)) {
        const integratedSearchUrl =
          this.innerConfig[CedarEmbeddableMetadataEditorComponent.TERMINOLOGY_INTEGRATED_SEARCH_URL];
        this.controlledFieldDataService.setTerminologyIntegratedSearchUrl(integratedSearchUrl);
      }
      if (Object.hasOwn(this.innerConfig, CedarEmbeddableMetadataEditorComponent.SHOW_SPINNER_BEFORE_INIT)) {
        this.showSpinnerBeforeInit = this.innerConfig[CedarEmbeddableMetadataEditorComponent.SHOW_SPINNER_BEFORE_INIT];
      }
      if (Object.hasOwn(this.innerConfig, CedarEmbeddableMetadataEditorComponent.LANGUAGE_MAP_PATH_PREFIX)) {
        const languageMapPathPrefix = this.innerConfig[CedarEmbeddableMetadataEditorComponent.LANGUAGE_MAP_PATH_PREFIX];
        this.globalSettingsContextService.languageMapPathPrefix = languageMapPathPrefix;
      }
      if (Object.hasOwn(this.innerConfig, CedarEmbeddableMetadataEditorComponent.FALLBACK_LANGUAGE)) {
        this.fallbackLanguage = this.innerConfig[CedarEmbeddableMetadataEditorComponent.FALLBACK_LANGUAGE];
      } else {
        this.messagingService.traceGroup(
          'language',
          '"fallbackLanguage" not set, using default: "' + this.fallbackLanguage + '"',
        );
      }
      if (Object.hasOwn(this.innerConfig, CedarEmbeddableMetadataEditorComponent.DEFAULT_LANGUAGE)) {
        this.defaultLanguage = this.innerConfig[CedarEmbeddableMetadataEditorComponent.DEFAULT_LANGUAGE];
      } else {
        this.messagingService.traceGroup(
          'language',
          '"defaultLanguage" not set, using default: "' + this.defaultLanguage + '"',
        );
      }
      if (Object.hasOwn(this.innerConfig, CedarEmbeddableMetadataEditorComponent.READ_ONLY_MODE)) {
        const mode = this.innerConfig[CedarEmbeddableMetadataEditorComponent.READ_ONLY_MODE];
        if (mode) {
          this.handlerContext.enableReadOnlyMode();
        }
      }
      if (Object.hasOwn(this.innerConfig, CedarEmbeddableMetadataEditorComponent.HIDE_EMPTY_FIELDS)) {
        // Hiding empty fields is only allowed in ReadOnly Mode
        const hideEmptyFields: boolean = this.innerConfig[CedarEmbeddableMetadataEditorComponent.HIDE_EMPTY_FIELDS];
        if (this.handlerContext.readOnlyMode && hideEmptyFields) {
          this.handlerContext.enableEmptyFieldHiding();
        }
      }
      this.translateService.setDefaultLang(this.fallbackLanguage);
      this.translateService.use(this.defaultLanguage);
    }
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
