import {Component, Input, OnInit, ViewEncapsulation} from '@angular/core';
import {SampleTemplatesService} from '../sample-templates.service';
import {
  CedarEmbeddableMetadataEditorWrapperComponent
} from '../../cedar-embeddable-metadata-editor-wrapper/cedar-embeddable-metadata-editor-wrapper.component';

@Component({
  selector: 'app-sample-template-select',
  templateUrl: './sample-template-select.component.html',
  styleUrls: ['./sample-template-select.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SampleTemplateSelectComponent implements OnInit {
  readonly TEMPLATE_NUMBER = 'templateNumber';
  readonly TEMPLATE_LABEL = 'label';

  @Input() callbackOwnerObject: any = null;
  selectedItem: any;
  sampleTemplates = [];


  constructor(private sampleTemplateService: SampleTemplatesService) {
  }

  ngOnInit(): void {
    const templateLocationPrefix = this.callbackOwnerObject.
      innerConfig[CedarEmbeddableMetadataEditorWrapperComponent.TEMPLATE_LOCATION_PREFIX];





      // sampleTemplatesObj = {
      //   '01': "Template 01 - single field",
      //   '02': "Template 02 - multi text field",
      //   '03': 'Template 03 - Multiple Required Field Template',
      //   '04': "Template 04 - numeric fields",
      //   '05': "Template 05 - single element",
      //   '06': "Template 06 - With Multiple element",
      //   '07': "Template 07 - 07 - email field",
      //   '08': "Template 08 - 08 - multiple choice",
      //   '09': "Template 09 - 09 - checkbox",
      //   '10': "Template 10 - 10 - checkbox with defaults",
      //   '11': "Template 11 - 11 - single select",
      //   '12': "Template 12 - 12 - multi select",
      //   '13': "Template 13 - 13 - attribute value",
      //   '14': "Template 14 - 14 - two level deep",
      //   '15': "Template 15 - 15 - rich text field",
      //   '16': "Template 16 - Phone Template",
      //   '17': "Template 17 - 17 - datetime template",
      //   '18': "Template 18 - 18 - datetime template multiple",
      //   '19': "Template 19 - 19 - paragraph",
      //   '20': "Template 20 - 20 - page break",
      //   '21': "Template 21 - 21 - controlled - mixed",
      //   '22': "Template 22 - 22 - multiple min none",
      //   '23': "Template 23 - 23 - multiple min 3",
      //   '24': "Template 24 - 24 - multiple element, min 4",
      //   '25': "Template 25 - 25 - two level deep, multiple",
      //   '26': "Template 26 - 26 - multiple element multiple field",
      //   '27': "Template 27 - 27 - link",
      //   '28': "Template 28 - 28 - multi element with several fields",
      //   '29': "Template 29 - 29 - multi element with several fields, one multi",
      //   '30': "Template 30 - 30 - element with multi-field, both min none",
      //   '31': "Template 31 - 31 - text field with constraints",
      //   '32': "Template 32 - 32 - numeric field - integer with u.m",
      //   '33': "Template 33 - 33 - numeric field - long integer",
      //   '34': "Template 34 - 34 - numeric field - single-precision",
      //   '35': "Template 35 - 35 - numeric field - double-precision",
      //   '36': "Template 36 - 36 - email field",
      //   '37': "Template 37 - 37 - section break",
      //   '38': "Template 38 - 38 - image before field",
      //   '39': "Template 39 - 39 - image before element",
      //   '40': "Template 40 - 40 - youtube full custom",
      //   '42': "Template 42 - 42 - controlled",
      //   '43': "Template 43 - 43 - controlled field",
      //   '51': "Template 51 - MiAIRR V1.1.0",
      //   '52': "Template 52 - eDNA ECT Demonstration",
      //   '53': "Template 53 - CEDAR-NCBI Human Tissue"
      // };



    //   const sampleTemplatesArr = Object.entries(sampleTemplatesObj).map(([num, label]) => ({num, label}));
    //
    //
    //   console.log('sampleTemplateObj');
    //   console.log(sampleTemplatesObj);
    //
    //
    //   console.log('sampleTemplatesArr');
    //   console.log(sampleTemplatesArr);
    //
    //
    //
    // });









  }


  inputChanged(event): void {

  }

}
