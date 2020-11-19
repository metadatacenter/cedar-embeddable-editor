import {Component, Input, OnInit} from '@angular/core';
import {HttpClient} from '@angular/common/http';

@Component({
  selector: 'app-cedar-embeddable-metadata-editor-wrapper',
  templateUrl: './cedar-embeddable-metadata-editor-wrapper.component.html',
  styleUrls: ['./cedar-embeddable-metadata-editor-wrapper.component.scss']
})
export class CedarEmbeddableMetadataEditorWrapperComponent implements OnInit {

  @Input() templateLocationPrefix: string = null;
  @Input() showSampleTemplateLinks: false;
  public templateJson: object = null;
  callbackOwnerObject = null;

  constructor(private http: HttpClient) {
    console.log('CedarEmbeddableMetadataEditorWrapperComponent.constructor');
    console.log('this.templateLocationPrefix' + this.templateLocationPrefix);
    console.log('this.showSampleTemplateLinks' + this.showSampleTemplateLinks);
    this.callbackOwnerObject = this;
  }

  ngOnInit(): void {
    console.log('CedarEmbeddableMetadataEditorWrapperComponent.ngOnInit');
    console.log('this.templateLocationPrefix' + this.templateLocationPrefix);
    console.log('this.showSampleTemplateLinks' + this.showSampleTemplateLinks);
    this.loadTemplate('07');
  }

  loadSampleTemplate(s: string): void {
    this.loadTemplate(s);
  }

  private loadTemplate(templateNumber: string): void {
    const url = this.templateLocationPrefix + templateNumber + '/template.json';
    this.http.get(url).subscribe(value => {
      this.templateJson = value;
    });
  }
}
