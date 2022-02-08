import {Component, Input, OnInit, ViewEncapsulation} from '@angular/core';
import {MessageHandlerService} from '../../service/message-handler.service';
import {MatListOption} from '@angular/material/list/public-api';
import {
  CedarEmbeddableMetadataEditorWrapperComponent
} from '../cedar-embeddable-metadata-editor-wrapper/cedar-embeddable-metadata-editor-wrapper.component';
import {HttpClient} from '@angular/common/http';
import {JsonSchema} from '../../models/json-schema.model';

@Component({
  selector: 'app-sample-templates',
  templateUrl: './sample-templates.component.html',
  styleUrls: ['./sample-templates.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SampleTemplatesComponent implements OnInit {

  private static readonly NUM_TEMPLATES = 60;
  @Input() callbackOwnerObject: any = null;
  @Input() expandedSampleTemplateLinks: boolean;
  sampleTemplates = new Object();

  constructor(
    private messageHandlerService: MessageHandlerService,
    private http: HttpClient
  ) {
  }

  ngOnInit(): void {
    this.loadAllTemplates();
  }

  isSelected(key): boolean {
    return this.callbackOwnerObject.innerConfig.hasOwnProperty(CedarEmbeddableMetadataEditorWrapperComponent.LOAD_SAMPLE_TEMPLATE_NAME) &&
      key === this.callbackOwnerObject.innerConfig[CedarEmbeddableMetadataEditorWrapperComponent.LOAD_SAMPLE_TEMPLATE_NAME];
  }

  loadBuiltinTemplate(s: string): void {
    this.callbackOwnerObject.loadSampleTemplate(s);
    window.scroll(0, 0);
  }

  loadAllTemplates(): void {
    for (let i = 1; i <= SampleTemplatesComponent.NUM_TEMPLATES; i++) {
      const templateName = (i < 10) ? '0' + i.toString() : i.toString();
      const url = this.callbackOwnerObject.innerConfig[CedarEmbeddableMetadataEditorWrapperComponent.TEMPLATE_LOCATION_PREFIX] + templateName + '/template.json';
      this.loadTemplateFromURL(templateName, url);
    }
  }

  private loadTemplateFromURL(templateNumber: string, url: string): void {
    this.http.get(url).subscribe(
      value => {
        this.sampleTemplates[templateNumber] = 'Template ' + templateNumber + ' - ' + value[JsonSchema.schemaName];
      },
      error => {
      }
    );
  }

  selectionClicked({option}: { option: MatListOption }): void {
    this.loadBuiltinTemplate(option.value);
  }

}
