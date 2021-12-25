import {Component, Input, OnInit, ViewEncapsulation} from '@angular/core';
import {MessageHandlerService} from '../../service/message-handler.service';
import {MatListOption} from '@angular/material/list/public-api';

@Component({
  selector: 'app-sample-templates',
  templateUrl: './sample-templates.component.html',
  styleUrls: ['./sample-templates.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SampleTemplatesComponent implements OnInit {

  @Input() callbackOwnerObject: any = null;
  @Input() expandedSampleTemplateLinks: boolean;

  sampleTemplates = {
    '01': 'Template 01 - text field, single',
    '02': 'Template 02 - text field, multi',
    '03': 'Template 03 - text field, multi with constraints ',
    '04': 'Template 04 - numeric fields, single + multi',
    '05': 'Template 05 - single element',
    '06': 'Template 06 - multiple element',
    '07': 'Template 07 - email field',
    '08': 'Template 08 - multiple choice',
    '09': 'Template 09 - checkbox',
    '10': 'Template 10 - checkbox with defaults',
    '11': 'Template 11 - pick from a list single select',
    '12': 'Template 12 - pick from a list multi select',
    '13': 'Template 13 - attribute value metadata',
    '14': 'Template 14 - two levels deep',
    '15': 'Template 15 - rich text, single',
    '16': 'Template 16 - phone, single',
    '17': 'Template 17 - datetime',
    '18': 'Template 18 - datetime multiple instances',
    '21': 'Template 21 - controlled - mixed',
    '22': 'Template 22 - multiple min none',
    '23': 'Template 23 - multiple min 3',
    '24': 'Template 24 - multiple element, min 4',
    '26': 'Template 26 - multiple element multiple field',
    '27': 'Template 27 - link field',
    '28': 'Template 28 - multi element with several fields',
    '29': 'Template 29 - multi element with several fields, one multi',
    '30': 'Template 30 - element with multi-field, both min none',
    '31': 'Template 31 - text field with constraints',
    '32': 'Template 32 - numeric field - integer with u.m',
    '33': 'Template 33 - numeric field - long integer',
    '34': 'Template 34 - numeric field - single-precision',
    '35': 'Template 35 - numeric field - double-precision',
    '36': 'Template 36 - email field',
    '37': 'Template 37 - section break',
    '38': 'Template 38 - image before field',
    '39': 'Template 39 - image before element',
    '40': 'Template 40 - youtube full custom',
    '42': 'Template 42 - controlled field',
    '43': 'Template 43 - controlled field',

    '51': 'Template 51 - MiAIRR V1.1.0',
    '52': 'Template 52 - eDNA ECT Demonstration'

  };

  constructor(
    private messageHandlerService: MessageHandlerService
  ) {
  }

  ngOnInit(): void {
  }

  loadBuiltinTemplate(s: string): void {
    this.messageHandlerService.trace('Load sample template: ' + s);
    this.callbackOwnerObject.loadSampleTemplate(s);
    window.scroll(0, 0);
  }

  selectionChanged({option}: { option: MatListOption }): void {
    this.loadBuiltinTemplate(option.value);
  }
}
