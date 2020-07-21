import {Component, Input, OnInit} from '@angular/core';

import {TemplateRepresentationFactory} from '../../factory/template-representation.factory';
import {TemplateComponent} from '../../models/template/template-component.model';
import {NullTemplateComponent} from '../../models/template/null-template-component.model';

@Component({
  selector: 'app-cedar-embeddable-metadata-editor',
  templateUrl: './cedar-embeddable-metadata-editor.component.html',
  styleUrls: ['./cedar-embeddable-metadata-editor.component.scss']
})
export class CedarEmbeddableMetadataEditorComponent implements OnInit {

  templateJsonObj: object;
  templateRepresentation: TemplateComponent = null;

  constructor() {
  }

  ngOnInit(): void {
  }

  @Input() set templateJsonObject(value: object) {
    this.templateJsonObj = value;
    this.templateRepresentation = TemplateRepresentationFactory.create(this.templateJsonObj);
  }

  templateAvailable(): boolean {
    return this.templateRepresentation != null && !(this.templateRepresentation instanceof NullTemplateComponent);
  }
}
