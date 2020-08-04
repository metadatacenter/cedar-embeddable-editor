import {Component, Input, OnInit, ViewChild} from '@angular/core';

import {TemplateRepresentationFactory} from '../../factory/template-representation.factory';
import {DataObjectService} from '../../service/data-object.service';
import {TemplateComponent} from '../../models/template/template-component.model';
import {NullTemplateComponent} from '../../models/template/null-template-component.model';
import {MatAccordion} from '@angular/material/expansion';
import {JsonPipe} from '@angular/common';

@Component({
  selector: 'app-cedar-embeddable-metadata-editor',
  templateUrl: './cedar-embeddable-metadata-editor.component.html',
  styleUrls: ['./cedar-embeddable-metadata-editor.component.scss']
})
export class CedarEmbeddableMetadataEditorComponent implements OnInit {

  templateJsonObj: object = null;
  templateJsonObjString: string = null;
  templateRepresentation: TemplateComponent = null;
  templateRepresentationString: string = null;
  instanceData: object = null;
  dataObjectService: DataObjectService = null;
  @ViewChild(MatAccordion) accordion: MatAccordion;

  constructor(private jsonPipe: JsonPipe) {
  }

  ngOnInit(): void {
  }

  @Input() set templateJsonObject(value: object) {
    this.templateJsonObj = value;
    this.templateJsonObjString = this.jsonPipe.transform(this.templateJsonObj);

    this.templateRepresentation = TemplateRepresentationFactory.create(this.templateJsonObj);
    this.templateRepresentationString = this.jsonPipe.transform(this.templateRepresentation);

    this.dataObjectService = new DataObjectService();
    this.instanceData = this.dataObjectService.buildNew(this.templateRepresentation);
  }

  templateAvailable(): boolean {
    return this.templateRepresentation != null && !(this.templateRepresentation instanceof NullTemplateComponent);
  }

}
