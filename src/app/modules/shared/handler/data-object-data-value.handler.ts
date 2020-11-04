import {MultiInstanceObjectInfo} from '../models/info/multi-instance-object-info.model';
import {CedarComponent} from '../models/component/cedar-component.model';
import {SingleElementComponent} from '../models/element/single-element-component.model';
import {CedarTemplate} from '../models/template/cedar-template.model';
import {MultiElementComponent} from '../models/element/multi-element-component.model';
import {DataContext} from '../util/data-context';
import {MultiInstanceObjectHandler} from './multi-instance-object.handler';
import {SingleFieldComponent} from '../models/field/single-field-component.model';
import {JsonSchema} from '../models/json-schema.model';
import {MultiFieldComponent} from '../models/field/multi-field-component.model';
import {FieldComponent} from '../models/component/field-component.model';
import {InstanceExtractData} from '../models/instance-extract-data.model';

export class DataObjectDataValueHandler {

  private setDataPathValueRecursively(dataObject: InstanceExtractData, component: CedarComponent, multiInstanceObjectService: MultiInstanceObjectHandler, path: string[], value: string): void {
    if (path.length === 0) {
      if (component instanceof SingleFieldComponent) {
        dataObject[JsonSchema.atValue] = value;
      } else {
        const multiField = component as MultiFieldComponent;
        const multiInstanceInfo: MultiInstanceObjectInfo = multiInstanceObjectService.getMultiInstanceInfoForComponent(multiField);
        const currentIndex = multiInstanceInfo.currentIndex;
        dataObject[currentIndex][JsonSchema.atValue] = value;
      }
    } else {
      const firstPath = path[0];
      const remainingPath = path.slice(1);
      let childComponent: CedarComponent = null;
      let dataSubObject = null;
      if (component instanceof SingleElementComponent) {
        childComponent = (component as SingleElementComponent).getChildByName(firstPath);
        dataSubObject = dataObject[firstPath];
      } else if (component instanceof CedarTemplate) {
        childComponent = (component as CedarTemplate).getChildByName(firstPath);
        dataSubObject = dataObject[firstPath];
      } else if (component instanceof MultiElementComponent) {
        const multiElement = component as MultiElementComponent;
        const multiInstanceInfo: MultiInstanceObjectInfo = multiInstanceObjectService.getMultiInstanceInfoForComponent(multiElement);
        const currentIndex = multiInstanceInfo.currentIndex;
        childComponent = multiElement.getChildByName(firstPath);
        dataSubObject = dataObject[currentIndex][firstPath];
      }
      this.setDataPathValueRecursively(dataSubObject, childComponent, multiInstanceObjectService, remainingPath, value);
    }
  }

  changeValue(dataContext: DataContext, component: FieldComponent, multiInstanceObjectService: MultiInstanceObjectHandler, value: string): void {
    const path = component.path;
    this.setDataPathValueRecursively(dataContext.instanceExtractData, dataContext.templateRepresentation, multiInstanceObjectService, path, value);
    this.setDataPathValueRecursively(dataContext.instanceFullData, dataContext.templateRepresentation, multiInstanceObjectService, path, value);
  }
}
