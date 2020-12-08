import {MultiComponent} from '../models/component/multi-component.model';
import {DataContext} from './data-context';
import {MultiInstanceObjectHandler} from '../handler/multi-instance-object.handler';
import {DataObjectBuilderHandler} from '../handler/data-object-builder.handler';
import {FieldComponent} from '../models/component/field-component.model';
import {DataObjectDataValueHandler} from '../handler/data-object-data-value.handler';
import {DataObjectStructureHandler} from '../handler/data-object-structure.handler';

export class HandlerContext {

  readonly dataObjectBuilderService: DataObjectBuilderHandler = null;
  readonly multiInstanceObjectService: MultiInstanceObjectHandler = null;
  readonly dataObjectManipulationService: DataObjectStructureHandler = null;
  readonly dataObjectDataValueHandler: DataObjectDataValueHandler = null;
  readonly dataContext: DataContext = null;

  public constructor(dataContext: DataContext) {
    this.dataObjectBuilderService = new DataObjectBuilderHandler();
    this.multiInstanceObjectService = new MultiInstanceObjectHandler();
    this.dataObjectBuilderService.injectMultiInstanceService(this.multiInstanceObjectService);
    this.dataObjectManipulationService = new DataObjectStructureHandler();
    this.dataObjectDataValueHandler = new DataObjectDataValueHandler();
    this.dataContext = dataContext;
  }

  addMultiInstance(component: MultiComponent): void {
    this.dataObjectManipulationService.multiInstanceItemAdd(this.dataContext, component, this.multiInstanceObjectService);
    this.multiInstanceObjectService.multiInstanceItemAdd(component);
  }

  copyMultiInstance(component: MultiComponent): void {
    this.dataObjectManipulationService.multiInstanceItemCopy(this.dataContext, component, this.multiInstanceObjectService);
    this.multiInstanceObjectService.multiInstanceItemCopy(component);
  }

  deleteMultiInstance(component: MultiComponent): void {
    this.dataObjectManipulationService.multiInstanceItemDelete(this.dataContext, component, this.multiInstanceObjectService);
    this.multiInstanceObjectService.multiInstanceItemDelete(component);
  }

  getDataObjectNodeByPath(path: string[]): object {
    return this.dataObjectManipulationService.getDataPathNodeRecursively(this.dataContext.instanceExtractData, this.dataContext.templateRepresentation, path, this.multiInstanceObjectService);
  }

  setCurrentIndex(component: MultiComponent, idx: number): void {
    this.multiInstanceObjectService.setCurrentIndex(component, idx);
  }

  changeValue(component: FieldComponent, value: string): void {
    this.dataObjectDataValueHandler.changeValue(this.dataContext, component, this.multiInstanceObjectService, value);
  }

  changeControlledValue(component: FieldComponent, atId: string, prefLabel: string): void {
    this.dataObjectDataValueHandler.changeControlledValue(this.dataContext, component, this.multiInstanceObjectService, atId, prefLabel);
  }
}
