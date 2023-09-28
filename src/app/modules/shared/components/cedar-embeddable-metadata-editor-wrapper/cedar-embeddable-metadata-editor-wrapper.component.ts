import {Component, Input, OnDestroy, OnInit, ViewEncapsulation} from '@angular/core';
import {HttpStatusCode} from '@angular/common/http';
import {ControlledFieldDataService} from '../../service/controlled-field-data.service';
import {MessageHandlerService} from '../../service/message-handler.service';
import {Subject} from 'rxjs';
import {SampleTemplatesService} from '../sample-templates/sample-templates.service';
import {takeUntil} from 'rxjs/operators';
import {JsonSchema} from '../../models/json-schema.model';
import {HandlerContext} from '../../util/handler-context';
import {ActiveComponentRegistryService} from '../../service/active-component-registry.service';
import {MultiInstanceObjectHandler} from '../../handler/multi-instance-object.handler';
import {TranslateService} from '@ngx-translate/core';
import {CedarEmbeddableMetadataEditorComponent} from '../cedar-embeddable-metadata-editor/cedar-embeddable-metadata-editor.component';

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
  handlerContext: HandlerContext = null;
  private metadata: object = null;
  private loadedTemplateJson: object = null;
  private loadedMetadata: object = null;


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
        this.triggerUpdateOnInjectedSampledata();
      });
    this.sampleTemplateService.metadataJson$
      .pipe(takeUntil(this.onDestroySubject))
      .subscribe(metadataJson => {
        if (metadataJson) {
          this.loadedMetadata = Object.values(metadataJson)[0];
        } else {
          this.loadedMetadata = null;
        }
        this.triggerUpdateOnInjectedSampledata();
      });
    this.initialized = true;
    this.doInitialize();
  }

  handlerContextChanged(event): void {
    this.handlerContext = event;
  }

  @Input() get currentMetadata(): object {
    if (this.handlerContext) {
      return JSON.parse(JSON.stringify(this.handlerContext.dataContext.instanceFullData));
    }
    return {};
  }

  private initDataFromInstance(): void {
    const instanceFullData = JSON.parse(JSON.stringify(this.metadata));
    const instanceExtractData = JSON.parse(JSON.stringify(this.metadata));
    this.deleteContext(instanceExtractData);
    if (this.handlerContext) {
      const dataContext = this.handlerContext.dataContext;
      dataContext.instanceFullData = instanceFullData;
      dataContext.instanceExtractData = instanceExtractData;
      const multiInstanceObjectService: MultiInstanceObjectHandler = this.handlerContext.multiInstanceObjectService;

      dataContext.multiInstanceData = multiInstanceObjectService.buildNewOrFromMetadata(
        dataContext.templateRepresentation, instanceExtractData);

      if (dataContext.templateRepresentation != null && dataContext.templateRepresentation.children != null) {
        setTimeout(() => {
          for (const childComponent of dataContext.templateRepresentation.children) {
            this.activeComponentRegistry.updateViewToModel(childComponent, this.handlerContext);
          }
        });
      }
    }
  }

  @Input() set templateObject(template: object) {
    this.templateJson = template;
  }

  @Input() set instanceObject(instance: object) {
    this.metadata = instance;
    this.initDataFromInstance();
  }

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

  private deleteContext(obj): void {
    const keyCount = Object.keys(obj).length;
    if (keyCount === 2 && obj.hasOwnProperty(JsonSchema.atId) && obj.hasOwnProperty(JsonSchema.rdfsLabel)) {
      // do nothing, it is a controlled term
    } else if (keyCount === 1 && obj.hasOwnProperty(JsonSchema.atId)) {
      // do nothing, it is a link
    } else {
      Object.keys(obj).forEach(key => {
        delete obj[JsonSchema.atContext];
        delete obj[JsonSchema.atId];
        delete obj[JsonSchema.oslcModifiedBy];
        delete obj[JsonSchema.pavCreatedOn];
        delete obj[JsonSchema.pavLastUpdatedOn];
        delete obj[JsonSchema.pavCreatedBy];
        delete obj[JsonSchema.schemaIsBasedOn];
        delete obj[JsonSchema.schemaName];
        delete obj[JsonSchema.schemaDescription];
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          this.deleteContext(obj[key]);
        }
      });
    }
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

  private triggerUpdateOnInjectedSampledata(): void {
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
