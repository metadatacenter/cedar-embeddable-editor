import {Component, Input, OnInit, ViewEncapsulation} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {ControlledFieldDataService} from '../../service/controlled-field-data.service';

@Component({
  selector: 'app-cedar-embeddable-metadata-editor-wrapper',
  templateUrl: './cedar-embeddable-metadata-editor-wrapper.component.html',
  styleUrls: ['./cedar-embeddable-metadata-editor-wrapper.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class CedarEmbeddableMetadataEditorWrapperComponent implements OnInit {

  static TEMPLATE_LOCATION_PREFIX = 'sampleTemplateLocationPrefix';
  static SHOW_SAMPLE_TEMPLATE_LINKS = 'showSampleTemplateLinks';
  static LOAD_SAMPLE_TEMPLATE_NAME = 'loadSampleTemplateName';
  static TERMINOLOGY_PROXY_URL = 'terminologyProxyUrl';

  innerConfig: object = null;
  private initialized = false;
  private configSet = false;

  public templateJson: object = null;
  callbackOwnerObject = null;

  constructor(
    private http: HttpClient,
    private controlledFieldDataService: ControlledFieldDataService
  ) {
    this.callbackOwnerObject = this;
  }

  ngOnInit(): void {
    this.initialized = true;
    this.doInitialize();
  }

  get staticSHOW_SAMPLE_TEMPLATE_LINKS(): string {
    return CedarEmbeddableMetadataEditorWrapperComponent.SHOW_SAMPLE_TEMPLATE_LINKS;
  }

  @Input() set config(value: object) {
    console.log('Cedar Embeddable Editor Config set:');
    console.log(value);
    this.innerConfig = value;
    this.configSet = true;
    this.doInitialize();
  }

  private doInitialize(): void {
    if (this.initialized && this.configSet) {
      if (this.innerConfig.hasOwnProperty(CedarEmbeddableMetadataEditorWrapperComponent.LOAD_SAMPLE_TEMPLATE_NAME)) {
        this.loadTemplate(this.innerConfig[CedarEmbeddableMetadataEditorWrapperComponent.LOAD_SAMPLE_TEMPLATE_NAME]);
      }
      if (this.innerConfig.hasOwnProperty(CedarEmbeddableMetadataEditorWrapperComponent.TERMINOLOGY_PROXY_URL)) {
        const proxyUrl = this.innerConfig[CedarEmbeddableMetadataEditorWrapperComponent.TERMINOLOGY_PROXY_URL];
        this.controlledFieldDataService.setTerminologyProxyUrl(proxyUrl);
      }
    }
  }

  loadSampleTemplate(s: string): void {
    this.loadTemplate(s);
  }

  private loadTemplate(templateName: string): void {
    const url = this.innerConfig[CedarEmbeddableMetadataEditorWrapperComponent.TEMPLATE_LOCATION_PREFIX] + templateName + '/template.json';
    this.http.get(url).subscribe(value => {
      this.templateJson = value;
    });
  }
}
