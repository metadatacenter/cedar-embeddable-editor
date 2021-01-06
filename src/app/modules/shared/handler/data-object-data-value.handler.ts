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

  private injectValue(target: InstanceExtractData, valueObject: object): void {
    if (valueObject.hasOwnProperty(JsonSchema.atValue)) {
      target[JsonSchema.atValue] = valueObject[JsonSchema.atValue];
    } else {
      delete target[JsonSchema.atValue];
      target[JsonSchema.atId] = valueObject[JsonSchema.atId];
      target[JsonSchema.rdfsLabel] = valueObject[JsonSchema.rdfsLabel];
    }
  }

  private setDataPathValueRecursively(dataObject: InstanceExtractData, component: CedarComponent, multiInstanceObjectService: MultiInstanceObjectHandler, path: string[], valueObject: object): void {
    if (path.length === 0) {
      if (component instanceof SingleFieldComponent) {
        this.injectValue(dataObject, valueObject);
      } else {
        const multiField = component as MultiFieldComponent;
        const multiInstanceInfo: MultiInstanceObjectInfo = multiInstanceObjectService.getMultiInstanceInfoForComponent(multiField);
        const currentIndex = multiInstanceInfo.currentIndex;
        this.injectValue(dataObject[currentIndex], valueObject);
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
      this.setDataPathValueRecursively(dataSubObject, childComponent, multiInstanceObjectService, remainingPath, valueObject);
    }
  }

  changeValue(dataContext: DataContext, component: FieldComponent, multiInstanceObjectService: MultiInstanceObjectHandler, value: string): void {
    const path = component.path;
    const valueObject = {};
    valueObject[JsonSchema.atValue] = value;
    this.setDataPathValueRecursively(dataContext.instanceExtractData, dataContext.templateRepresentation, multiInstanceObjectService, path, valueObject);
    this.setDataPathValueRecursively(dataContext.instanceFullData, dataContext.templateRepresentation, multiInstanceObjectService, path, valueObject);
  }

  changeControlledValue(dataContext: DataContext, component: FieldComponent, multiInstanceObjectService: MultiInstanceObjectHandler, atId: string, prefLabel: string): void {
    const path = component.path;
    const valueObject = {};
    valueObject[JsonSchema.atId] = atId;
    valueObject[JsonSchema.rdfsLabel] = prefLabel;
    this.setDataPathValueRecursively(dataContext.instanceExtractData, dataContext.templateRepresentation, multiInstanceObjectService, path, valueObject);
    this.setDataPathValueRecursively(dataContext.instanceFullData, dataContext.templateRepresentation, multiInstanceObjectService, path, valueObject);
  }

}
