import {Component, Input, OnInit} from '@angular/core';

import {TemplateRepresentation} from '../../models/template/template-representation.model';
import {TemplateRepresentationFactory} from '../../factory/template-representation.factory';

@Component({
  selector: 'app-cedar-embeddable-metadata-editor',
  templateUrl: './cedar-embeddable-metadata-editor.component.html',
  styleUrls: ['./cedar-embeddable-metadata-editor.component.scss']
})
export class CedarEmbeddableMetadataEditorComponent implements OnInit {

  @Input() templateJsonObj: object;
  templateRepresentation: TemplateRepresentation;

  constructor() {
  }

  ngOnInit(): void {
  }

  @Input() set templateJsonObject(value: object) {
    this.templateJsonObj = value;
    this.templateRepresentation = TemplateRepresentationFactory.create(this.templateJsonObj);
    //console.log('CHANGED:');
    //console.log(this.templateJsonObj);
    //console.log(this.templateRepresentation);
  }

}
