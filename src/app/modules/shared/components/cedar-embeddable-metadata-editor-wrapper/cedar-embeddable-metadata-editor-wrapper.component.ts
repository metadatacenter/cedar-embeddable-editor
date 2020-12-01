import {Component, Input, OnInit, ViewEncapsulation} from '@angular/core';
import {HttpClient} from '@angular/common/http';

@Component({
  selector: 'app-cedar-embeddable-metadata-editor-wrapper',
  templateUrl: './cedar-embeddable-metadata-editor-wrapper.component.html',
  styleUrls: ['./cedar-embeddable-metadata-editor-wrapper.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class CedarEmbeddableMetadataEditorWrapperComponent implements OnInit {

  static TEMPLATE_LOCATION_PREFIX = 'templateLocationPrefix';
  static SHOW_SAMPLE_TEMPLATE_LINKS = 'showSampleTemplateLinks';

  innerConfig: object = null;
  private initialized = false;
  private configSet = false;

  public templateJson: object = null;
  callbackOwnerObject = null;

  constructor(private http: HttpClient) {
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
      this.loadTemplate('01');
    }
  }

  loadSampleTemplate(s: string): void {
    this.loadTemplate(s);
  }

  private loadTemplate(templateNumber: string): void {
    const url = this.innerConfig[CedarEmbeddableMetadataEditorWrapperComponent.TEMPLATE_LOCATION_PREFIX] + templateNumber + '/template.json';
    this.http.get(url).subscribe(value => {
      this.templateJson = value;
    });
  }
}
