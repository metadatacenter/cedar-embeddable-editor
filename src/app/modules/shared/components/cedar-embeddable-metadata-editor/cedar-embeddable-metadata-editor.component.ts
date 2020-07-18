import {Component, Input, OnInit} from '@angular/core';

import {TemplateRepresentationFactory} from '../../factory/template-representation.factory';
import {CedarTemplate} from '../../models/template/cedar-template.model';
import {TemplateComponent} from '../../models/template/template-component.model';

@Component({
  selector: 'app-cedar-embeddable-metadata-editor',
  templateUrl: './cedar-embeddable-metadata-editor.component.html',
  styleUrls: ['./cedar-embeddable-metadata-editor.component.scss']
})
export class CedarEmbeddableMetadataEditorComponent implements OnInit {

  @Input() templateJsonObj: object;
  templateRepresentation: TemplateComponent;

  constructor() {
  }

  ngOnInit(): void {
  }

  @Input() set templateJsonObject(value: object) {
    this.templateJsonObj = value;
    this.templateRepresentation = TemplateRepresentationFactory.create(this.templateJsonObj);
  }

}
