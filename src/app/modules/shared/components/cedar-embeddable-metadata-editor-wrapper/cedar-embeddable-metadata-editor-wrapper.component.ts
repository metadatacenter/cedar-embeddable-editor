import {Component, Input, OnDestroy, OnInit, ViewEncapsulation} from '@angular/core';
import {HttpResponse, HttpStatusCode} from '@angular/common/http';
import {ControlledFieldDataService} from '../../service/controlled-field-data.service';
import {MessageHandlerService} from '../../service/message-handler.service';
import {MatFileUploadService} from '../file-uploader/mat-file-upload/mat-file-upload.service';
import {Subject} from 'rxjs';
import {SampleTemplatesService} from '../sample-templates/sample-templates.service';
import {takeUntil} from 'rxjs/operators';
import {JsonSchema} from '../../models/json-schema.model';
import {HandlerContext} from '../../util/handler-context';
import {ActiveComponentRegistryService} from '../../service/active-component-registry.service';
import {MultiInstanceObjectHandler} from '../../handler/multi-instance-object.handler';
import {environment} from "../../../../../environments/environment";
import {LocalSettingsService} from "../../service/local-settings.service";
import {TranslateService} from "@ngx-translate/core";

@Component({
  selector: 'app-cedar-embeddable-metadata-editor-wrapper',
  templateUrl: './cedar-embeddable-metadata-editor-wrapper.component.html',
  styleUrls: ['./cedar-embeddable-metadata-editor-wrapper.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class CedarEmbeddableMetadataEditorWrapperComponent implements OnInit, OnDestroy {

  static TEMPLATE_LOCATION_PREFIX = 'sampleTemplateLocationPrefix';
  static LOAD_SAMPLE_TEMPLATE_NAME = 'loadSampleTemplateName';
  static TERMINOLOGY_PROXY_URL = 'terminologyProxyUrl';
  static SHOW_SPINNER_BEFORE_INIT = 'showSpinnerBeforeInit';
  static TEMPLATE_UPLOAD_BASE_URL = 'templateUploadBaseUrl';
  static TEMPLATE_DOWNLOAD_ENDPOINT = 'templateDownloadEndpoint';
  static TEMPLATE_DOWNLOAD_PARAM_NAME = 'templateDownloadParamName';
  static TEMPLATE_JSON = 'templateJSON';
  static INSTANCE_JSON = 'instanceJSON';

  innerConfig: object = null;
  private initialized = false;
  private configSet = false;

  public templateJson: object = null;
  sampleTemplateLoaderObject = null;
  showSpinnerBeforeInit = true;
  protected _onDestroy = new Subject<void>();
  externalTemplateInfo: object;
  handlerContext: HandlerContext = null;
  private instanceJson = null;


  constructor(
    private controlledFieldDataService: ControlledFieldDataService,
    private messageHandlerService: MessageHandlerService,
    private matFileUploadService: MatFileUploadService,
    private sampleTemplateService: SampleTemplatesService,
    private activeComponentRegistry: ActiveComponentRegistryService,
    private localSettings: LocalSettingsService,
    private translateService: TranslateService
  ) {
    this.sampleTemplateLoaderObject = this;

    // this language will be used as a fallback when a translation isn't found in the current language
    this.translateService.setDefaultLang(environment.fallbackLanguage);

    // the lang to use, if the lang isn't available, it will use the current loader to get them
    let currentLanguage = this.localSettings.getLanguage();
    if (currentLanguage == null) {
      currentLanguage = environment.defaultLanguage;
    }
    this.translateService.use(currentLanguage);
  }

  ngOnInit(): void {

    this.sampleTemplateService.templateJson$
      .pipe(takeUntil(this._onDestroy))
      .subscribe(templateJson => {
        if (templateJson) {
          this.templateJson = Object.values(templateJson)[0];
        }
      });
    this.matFileUploadService.uploadedFile$
      .pipe(takeUntil(this._onDestroy))
      .subscribe(fileInfo => {
        if (fileInfo && fileInfo['event'] instanceof HttpResponse) {
          const statusCode = fileInfo['event']['status'];

          if (statusCode === HttpStatusCode.Created &&
            this.innerConfig.hasOwnProperty(CedarEmbeddableMetadataEditorWrapperComponent.TEMPLATE_UPLOAD_BASE_URL) &&
            this.innerConfig.hasOwnProperty(CedarEmbeddableMetadataEditorWrapperComponent.TEMPLATE_DOWNLOAD_ENDPOINT) &&
            this.innerConfig.hasOwnProperty(CedarEmbeddableMetadataEditorWrapperComponent.TEMPLATE_DOWNLOAD_PARAM_NAME)) {
            const filename = fileInfo['event']['body']['filename'];
            const templateUrl = this.innerConfig[CedarEmbeddableMetadataEditorWrapperComponent.TEMPLATE_UPLOAD_BASE_URL] +
              this.innerConfig[CedarEmbeddableMetadataEditorWrapperComponent.TEMPLATE_DOWNLOAD_ENDPOINT] + '?' +
              this.innerConfig[CedarEmbeddableMetadataEditorWrapperComponent.TEMPLATE_DOWNLOAD_PARAM_NAME] + '=' + filename;
            this.sampleTemplateService.loadTemplateFromURL(templateUrl);
          }
        }
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

  @Input() set metadata(meta: object) {
    const instanceFullData = JSON.parse(JSON.stringify(meta));
    const instanceExtractData = JSON.parse(JSON.stringify(meta));
    this.deleteContext(instanceExtractData);
    if (this.handlerContext) {
      const dataContext = this.handlerContext.dataContext;
      dataContext.instanceFullData = instanceFullData;
      dataContext.instanceExtractData = instanceExtractData;
      const multiInstanceObjectService: MultiInstanceObjectHandler = this.handlerContext.multiInstanceObjectService;

      dataContext.multiInstanceData = multiInstanceObjectService.buildNewOrFromMetadata(
        dataContext.templateRepresentation, instanceExtractData);

      if (dataContext.templateRepresentation != null && dataContext.templateRepresentation.children != null) {
        for (const childComponent of dataContext.templateRepresentation.children) {
          this.activeComponentRegistry.updateViewToModel(childComponent, this.handlerContext);
        }
      }
    }
  }

  @Input() set templateInfo(templateInfo: object) {
    this.externalTemplateInfo = templateInfo;
  }

  @Input() set templateObject(template: object) {
    this.templateJson = template;
  }

  @Input() set instanceObject(instance: object) {
    this.metadata = instance;
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
    this._onDestroy.next();
    this._onDestroy.complete();
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
    Object.keys(obj).forEach(key => {
      delete obj[JsonSchema.atContext];

      if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.deleteContext(obj[key]);
      }
    });
  }

  private doInitialize(): void {
    if (this.initialized && this.configSet) {
      if (this.innerConfig.hasOwnProperty(CedarEmbeddableMetadataEditorWrapperComponent.LOAD_SAMPLE_TEMPLATE_NAME)) {
        this.sampleTemplateService.loadTemplate(
          this.innerConfig[CedarEmbeddableMetadataEditorWrapperComponent.TEMPLATE_LOCATION_PREFIX],
          this.innerConfig[CedarEmbeddableMetadataEditorWrapperComponent.LOAD_SAMPLE_TEMPLATE_NAME]);
      }
      if (this.innerConfig.hasOwnProperty(CedarEmbeddableMetadataEditorWrapperComponent.TERMINOLOGY_PROXY_URL)) {
        const proxyUrl = this.innerConfig[CedarEmbeddableMetadataEditorWrapperComponent.TERMINOLOGY_PROXY_URL];
        this.controlledFieldDataService.setTerminologyProxyUrl(proxyUrl);
      }
      if (this.innerConfig.hasOwnProperty(CedarEmbeddableMetadataEditorWrapperComponent.SHOW_SPINNER_BEFORE_INIT)) {
        this.showSpinnerBeforeInit = this.innerConfig[CedarEmbeddableMetadataEditorWrapperComponent.SHOW_SPINNER_BEFORE_INIT];
      }
    }
  }

  // used only for debugging of restoring metadata
  private restoreMetadataFromURL(metaUrl, successHandler = null, errorHandler = null): void {
    const xhr = new XMLHttpRequest();
    xhr.onreadystatechange = () => {
      if (xhr.readyState === XMLHttpRequest.DONE) {
        if (xhr.status === 200) {
          const jsonMeta = JSON.parse(xhr.responseText);
          this.metadata = jsonMeta;

          if (successHandler) {
            successHandler(jsonMeta);
          }
        } else {
          if (errorHandler) {
            errorHandler(xhr);
          }
        }
      }
    };
    xhr.open('GET', metaUrl, true);
    xhr.send();
  }

  editorDataReady(): boolean {
    return this.innerConfig != null && this.templateJson != null;
  }
}
