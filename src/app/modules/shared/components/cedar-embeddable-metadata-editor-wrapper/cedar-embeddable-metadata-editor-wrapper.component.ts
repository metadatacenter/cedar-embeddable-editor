import {Component, Input, OnDestroy, OnInit, ViewEncapsulation} from '@angular/core';
import {HttpResponse, HttpStatusCode} from '@angular/common/http';
import {ControlledFieldDataService} from '../../service/controlled-field-data.service';
import {MessageHandlerService} from '../../service/message-handler.service';
import {MatFileUploadService} from '../file-uploader/mat-file-upload/mat-file-upload.service';
import {Subject} from 'rxjs';
import {SampleTemplatesService} from '../sample-templates/sample-templates.service';
import {takeUntil} from 'rxjs/operators';

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

  innerConfig: object = null;
  private initialized = false;
  private configSet = false;

  public templateJson: object = null;
  sampleTemplateLoaderObject = null;
  showSpinnerBeforeInit = true;
  protected _onDestroy = new Subject<void>();


  constructor(
    private controlledFieldDataService: ControlledFieldDataService,
    private messageHandlerService: MessageHandlerService,
    private matFileUploadService: MatFileUploadService,
    private sampleTemplateService: SampleTemplatesService
  ) {
    this.sampleTemplateLoaderObject = this;
  }

  ngOnInit(): void {
    this.sampleTemplateService.templateJson$
      .pipe(takeUntil(this._onDestroy))
      .subscribe( templateJson => {
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

  editorDataReady(): boolean {
    return this.innerConfig != null && this.templateJson != null;
  }

}
