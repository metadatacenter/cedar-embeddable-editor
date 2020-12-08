import {Component, Input, OnInit, ViewChild, ViewEncapsulation} from '@angular/core';
import {NullTemplateComponent} from '../../models/template/null-template-component.model';
import {MatAccordion} from '@angular/material/expansion';
import {JsonPipe} from '@angular/common';
import {DataContext} from '../../util/data-context';
import {HandlerContext} from '../../util/handler-context';

@Component({
  selector: 'app-cedar-embeddable-metadata-editor',
  templateUrl: './cedar-embeddable-metadata-editor.component.html',
  styleUrls: ['./cedar-embeddable-metadata-editor.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class CedarEmbeddableMetadataEditorComponent implements OnInit {

  private static SHOW_TEMPLATE_RENDERING = 'showTemplateRenderingRepresentation';
  private static SHOW_MULTI_INSTANCE = 'showMultiInstanceInfo';
  private static SHOW_TEMPLATE_SOURCE = 'showTemplateSourceData';
  private static SHOW_INSTANCE_CORE = 'showInstanceDataCore';
  private static SHOW_INSTANCE_FULL = 'showInstanceDataFull';

  private readonly dataContext: DataContext = null;
  private readonly handlerContext: HandlerContext = null;

  showTemplateRenderingRepresentation = false;
  showMultiInstanceInfo = false;
  showTemplateSourceData = true;
  showInstanceDataCore = false;
  showInstanceDataFull = true;

  @ViewChild(MatAccordion) accordion: MatAccordion;

  constructor(
    private jsonPipe: JsonPipe
  ) {
    this.dataContext = new DataContext();
    this.handlerContext = new HandlerContext(this.dataContext);
  }

  ngOnInit(): void {
  }

  @Input() set config(value: object) {
    if (value != null) {
      if (value.hasOwnProperty(CedarEmbeddableMetadataEditorComponent.SHOW_TEMPLATE_RENDERING)) {
        this.showTemplateRenderingRepresentation = value[CedarEmbeddableMetadataEditorComponent.SHOW_TEMPLATE_RENDERING];
      }
      if (value.hasOwnProperty(CedarEmbeddableMetadataEditorComponent.SHOW_MULTI_INSTANCE)) {
        this.showMultiInstanceInfo = value[CedarEmbeddableMetadataEditorComponent.SHOW_MULTI_INSTANCE];
      }
      if (value.hasOwnProperty(CedarEmbeddableMetadataEditorComponent.SHOW_TEMPLATE_SOURCE)) {
        this.showTemplateSourceData = value[CedarEmbeddableMetadataEditorComponent.SHOW_TEMPLATE_SOURCE];
      }
      if (value.hasOwnProperty(CedarEmbeddableMetadataEditorComponent.SHOW_INSTANCE_CORE)) {
        this.showInstanceDataCore = value[CedarEmbeddableMetadataEditorComponent.SHOW_INSTANCE_CORE];
      }
      if (value.hasOwnProperty(CedarEmbeddableMetadataEditorComponent.SHOW_INSTANCE_FULL)) {
        this.showInstanceDataFull = value[CedarEmbeddableMetadataEditorComponent.SHOW_INSTANCE_FULL];
      }
    }
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
