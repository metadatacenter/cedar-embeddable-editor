import {CedarInputTemplate} from '../models/cedar-input-template.model';
import {TemplateComponent} from '../models/template/template-component.model';
import {MultiInstanceInfo} from '../models/info/multi-instance-info.model';
import {TemplateRepresentationFactory} from '../factory/template-representation.factory';
import {InstanceExtractData} from '../models/instance-extract-data.model';
import {InstanceFullData} from '../models/instance-full-data.model';
import {HandlerContext} from './handler-context';
import {MultiInstanceObjectHandler} from '../handler/multi-instance-object.handler';
import {DataObjectBuilderHandler} from '../handler/data-object-builder.handler';

export class DataContext {

  templateInput: CedarInputTemplate = null;
  templateRepresentation: TemplateComponent = null;
  instanceExtractData: InstanceExtractData = null;
  instanceFullData: InstanceFullData = null;
  multiInstanceData: MultiInstanceInfo = null;

  public constructor() {
  }

  setInputTemplate(value: object, handlerContext: HandlerContext): void {
    this.templateInput = value as CedarInputTemplate;
    this.templateRepresentation = TemplateRepresentationFactory.create(this.templateInput);

    const multiInstanceObjectService: MultiInstanceObjectHandler = handlerContext.multiInstanceObjectService;
    const dataObjectService: DataObjectBuilderHandler = handlerContext.dataObjectBuilderService;

    this.instanceExtractData = dataObjectService.buildNewExtractDataObject(this.templateRepresentation);
    this.instanceFullData = dataObjectService.buildNewFullDataObject(this.templateRepresentation, this.templateInput);
    this.multiInstanceData = multiInstanceObjectService.buildNew(this.templateRepresentation);
  }

}
