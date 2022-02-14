import {Component, Input, OnInit, ViewEncapsulation} from '@angular/core';
import {SampleTemplatesService} from '../sample-templates.service';
import {
  CedarEmbeddableMetadataEditorWrapperComponent
} from '../../cedar-embeddable-metadata-editor-wrapper/cedar-embeddable-metadata-editor-wrapper.component';
import {MatListOption} from '@angular/material/list/public-api';

@Component({
  selector: 'app-sample-template-select',
  templateUrl: './sample-template-select.component.html',
  styleUrls: ['./sample-template-select.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SampleTemplateSelectComponent implements OnInit {
  @Input() callbackOwnerObject: any = null;
  sampleTemplates: object;
  selectedItem: string;

  constructor(private sampleTemplateService: SampleTemplatesService) {
  }

  ngOnInit(): void {
    const templateLocationPrefix = this.callbackOwnerObject.
      innerConfig[CedarEmbeddableMetadataEditorWrapperComponent.TEMPLATE_LOCATION_PREFIX];
    this.sampleTemplateService.getSampleTemplates(templateLocationPrefix).subscribe(
      (templates: object) => {
        this.sampleTemplates = templates;
      }
    );

    if (this.callbackOwnerObject.innerConfig.hasOwnProperty(CedarEmbeddableMetadataEditorWrapperComponent.LOAD_SAMPLE_TEMPLATE_NAME)) {
      this.selectedItem = this.callbackOwnerObject.innerConfig[CedarEmbeddableMetadataEditorWrapperComponent.LOAD_SAMPLE_TEMPLATE_NAME];
    }
  }

  loadBuiltinTemplate(s: string): void {
    this.callbackOwnerObject.loadSampleTemplate(s);
    window.scroll(0, 0);
  }

  inputChanged(event): void {
    if (event) {
      this.loadBuiltinTemplate(event.value);
    }
  }

}
