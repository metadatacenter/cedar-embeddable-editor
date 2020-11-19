import {Component, Input, OnInit, ViewChild} from '@angular/core';
import {NullTemplateComponent} from '../../models/template/null-template-component.model';
import {MatAccordion} from '@angular/material/expansion';
import {JsonPipe} from '@angular/common';
import {DataContext} from '../../util/data-context';
import {HandlerContext} from '../../util/handler-context';

@Component({
  selector: 'app-cedar-embeddable-metadata-editor',
  templateUrl: './cedar-embeddable-metadata-editor.component.html',
  styleUrls: ['./cedar-embeddable-metadata-editor.component.scss']
})
export class CedarEmbeddableMetadataEditorComponent implements OnInit {

  private readonly dataContext: DataContext = null;
  private readonly handlerContext: HandlerContext = null;

  @ViewChild(MatAccordion) accordion: MatAccordion;

  constructor(private jsonPipe: JsonPipe) {
    this.dataContext = new DataContext();
    this.handlerContext = new HandlerContext(this.dataContext);
  }

  ngOnInit(): void {
  }

  @Input() set templateJsonObject(value: object) {
    if (value != null) {
      const len = JSON.stringify(value).length;
      console.log('CEDAR Embeddable Editor started with template of length ' + len + ' characters.');
      this.dataContext.setInputTemplate(value, this.handlerContext);
    }
  }

  dataAvailableForRender(): boolean {
    return this.dataContext != null
      && this.dataContext.templateRepresentation != null
      && !(this.dataContext.templateRepresentation instanceof NullTemplateComponent)
      && this.dataContext.multiInstanceData != null;
  }

}
