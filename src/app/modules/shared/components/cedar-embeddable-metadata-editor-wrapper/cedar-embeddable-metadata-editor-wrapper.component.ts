import {Component, Input, OnDestroy, OnInit, ViewChild, ViewEncapsulation} from '@angular/core';
import {ControlledFieldDataService} from '../../service/controlled-field-data.service';
import {MessageHandlerService} from '../../service/message-handler.service';
import {Subject} from 'rxjs';
import {SampleTemplatesService} from '../sample-templates/sample-templates.service';
import {takeUntil} from 'rxjs/operators';
import {HandlerContext} from '../../util/handler-context';
import {ActiveComponentRegistryService} from '../../service/active-component-registry.service';
import {TranslateService} from '@ngx-translate/core';
import {CedarEmbeddableMetadataEditorComponent} from '../cedar-embeddable-metadata-editor/cedar-embeddable-metadata-editor.component';
import {DataContext} from '../../util/data-context';
import {HttpStatusCode} from '@angular/common/http';

@Component({
  selector: 'app-cedar-embeddable-metadata-editor-wrapper',
  templateUrl: './cedar-embeddable-metadata-editor-wrapper.component.html',
  styleUrls: ['./cedar-embeddable-metadata-editor-wrapper.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class CedarEmbeddableMetadataEditorWrapperComponent implements OnInit, OnDestroy {

  innerConfig: object = null;
  private initialized = false;
  private configSet = false;

  templateJson: object = null;
  sampleTemplateLoaderObject = null;
  showSpinnerBeforeInit = true;
  protected onDestroySubject = new Subject<void>();
  private loadedTemplateJson: object = null;
  private loadedMetadata: object = null;

  readonly dataContext: DataContext = null;
  readonly handlerContext: HandlerContext = null;

  @ViewChild(CedarEmbeddableMetadataEditorComponent) editorComponent: CedarEmbeddableMetadataEditorComponent;


  constructor(
      private controlledFieldDataService: ControlledFieldDataService,
      private messageHandlerService: MessageHandlerService,
      private sampleTemplateService: SampleTemplatesService,
      private activeComponentRegistry: ActiveComponentRegistryService,
      private translateService: TranslateService
  ) {
    this.sampleTemplateLoaderObject = this;

    const fallbackLanguage = 'en';
    const defaultLanguage = 'en';
    this.translateService.setDefaultLang(fallbackLanguage);
    this.translateService.use(defaultLanguage);

    this.dataContext = new DataContext();
    this.handlerContext = new HandlerContext(this.dataContext);

  }

  ngOnInit(): void {

    this.sampleTemplateService.templateJson$
        .pipe(takeUntil(this.onDestroySubject))
        .subscribe(templateJson => {
          if (templateJson) {
            this.loadedTemplateJson = Object.values(templateJson)[0];
          } else {
            this.loadedTemplateJson = null;
          }
          this.triggerUpdateOnInjectedSampleData();
        });
    this.sampleTemplateService.metadataJson$
        .pipe(takeUntil(this.onDestroySubject))
        .subscribe(metadataJson => {
          if (metadataJson) {
            this.loadedMetadata = Object.values(metadataJson)[0];
          } else {
            this.loadedMetadata = null;
          }
          this.triggerUpdateOnInjectedSampleData();
        });
    this.initialized = true;
    this.doInitialize();
  }

  @Input() get currentMetadata(): object {
    if (this.handlerContext) {
      return JSON.parse(JSON.stringify(this.handlerContext.dataContext.instanceFullData));
    }
    return {};
  }

  @Input() set templateObject(template: object) {
    this.templateJson = template;
  }

  @Input() set instanceObject(instance: object) {
    this.editorComponent.initDataFromInstance(instance);
  }

  // TODO: revisit if this method is needed. The CEE should be agnostic of the environment, should expect the config to be injected
  @Input() loadConfigFromURL(jsonURL, successHandler = null, errorHandler = null): void {
    const that = this;
    const xhr = new XMLHttpRequest();
    xhr.onreadystatechange = () => {
      if (xhr.readyState === XMLHttpRequest.DONE) {
        if (xhr.status === HttpStatusCode.Ok) {
          const jsonConfig = JSON.parse(xhr.responseText);
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
    this.messageHandlerService.traceObject('CEDAR Embeddable Editor config set to:', value);

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
      if (this.innerConfig.hasOwnProperty(CedarEmbeddableMetadataEditorComponent.LOAD_SAMPLE_TEMPLATE_NAME)) {
        this.sampleTemplateService.loadTemplate(
            this.innerConfig[CedarEmbeddableMetadataEditorComponent.TEMPLATE_LOCATION_PREFIX],
            this.innerConfig[CedarEmbeddableMetadataEditorComponent.LOAD_SAMPLE_TEMPLATE_NAME]);
      }
      if (this.innerConfig.hasOwnProperty(CedarEmbeddableMetadataEditorComponent.TERMINOLOGY_INTEGRATED_SEARCH_URL)) {
        const integratedSearchUrl = this.innerConfig[CedarEmbeddableMetadataEditorComponent.TERMINOLOGY_INTEGRATED_SEARCH_URL];
        this.controlledFieldDataService.setTerminologyIntegratedSearchUrl(integratedSearchUrl);
      }
      if (this.innerConfig.hasOwnProperty(CedarEmbeddableMetadataEditorComponent.SHOW_SPINNER_BEFORE_INIT)) {
        this.showSpinnerBeforeInit = this.innerConfig[CedarEmbeddableMetadataEditorComponent.SHOW_SPINNER_BEFORE_INIT];
      }

      if (this.innerConfig.hasOwnProperty(CedarEmbeddableMetadataEditorComponent.FALLBACK_LANGUAGE)) {
        const fallbackLanguage = this.innerConfig[CedarEmbeddableMetadataEditorComponent.FALLBACK_LANGUAGE];
        this.translateService.setDefaultLang(fallbackLanguage);
      }
      if (this.innerConfig.hasOwnProperty(CedarEmbeddableMetadataEditorComponent.DEFAULT_LANGUAGE)) {
        const defaultLanguage = this.innerConfig[CedarEmbeddableMetadataEditorComponent.DEFAULT_LANGUAGE];
        this.translateService.use(defaultLanguage);
      }
    }
  }

  editorDataReady(): boolean {
    return this.innerConfig != null && this.templateJson != null;
  }

  private triggerUpdateOnInjectedSampleData(): void {
    if (this.loadedTemplateJson != null) {
      this.templateObject = this.loadedTemplateJson;
    }
    if (this.loadedMetadata !== null) {
      setTimeout(() => {
        if (this.loadedMetadata !== null) {
          this.instanceObject = this.loadedMetadata;
        }
      });
    }
  }
}
