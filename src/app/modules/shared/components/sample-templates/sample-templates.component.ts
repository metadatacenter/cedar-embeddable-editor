import {Component, Input, OnInit, ViewEncapsulation} from '@angular/core';
import {MessageHandlerService} from '../../service/message-handler.service';
import {MatListOption} from '@angular/material/list/public-api';
import {
  CedarEmbeddableMetadataEditorWrapperComponent
} from '../cedar-embeddable-metadata-editor-wrapper/cedar-embeddable-metadata-editor-wrapper.component';
import {HttpClient} from '@angular/common/http';
import {SampleTemplatesService} from './sample-templates.service';

@Component({
  selector: 'app-sample-templates',
  templateUrl: './sample-templates.component.html',
  styleUrls: ['./sample-templates.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SampleTemplatesComponent implements OnInit {

  @Input() callbackOwnerObject: any = null;
  @Input() expandedSampleTemplateLinks: boolean;
  sampleTemplates: object[];


  constructor(
    private messageHandlerService: MessageHandlerService,
    private http: HttpClient,
    private sampleTemplateService: SampleTemplatesService
  ) {
  }

  ngOnInit(): void {
    const templateLocationPrefix = this.callbackOwnerObject.
      innerConfig[CedarEmbeddableMetadataEditorWrapperComponent.TEMPLATE_LOCATION_PREFIX];
    this.sampleTemplateService.getSampleTemplates(templateLocationPrefix).subscribe(
      (templates: object[]) => {
        this.sampleTemplates = templates;
      }
    );
  }

  isSelected(key): boolean {
    return this.callbackOwnerObject.innerConfig.hasOwnProperty(CedarEmbeddableMetadataEditorWrapperComponent.LOAD_SAMPLE_TEMPLATE_NAME) &&
      key === this.callbackOwnerObject.innerConfig[CedarEmbeddableMetadataEditorWrapperComponent.LOAD_SAMPLE_TEMPLATE_NAME];
  }

  loadBuiltinTemplate(s: string): void {
    this.callbackOwnerObject.loadSampleTemplate(s);
    window.scroll(0, 0);
  }

  selectionClicked({option}: { option: MatListOption }): void {
    this.loadBuiltinTemplate(option.value);
  }

}
