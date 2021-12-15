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

  private injectArrayValue(target: InstanceExtractData, valueArray: object[]): void {
    (target as Array<object>).length = 0;
    (target as Array<object>).push(...valueArray);
  }








  private injectAttributeValue(dataObject: InstanceExtractData, parentDataObject: InstanceExtractData, valueObject: object, currentIndex: number): void {

    const oldName = dataObject[currentIndex];
    dataObject[currentIndex] = valueObject[JsonSchema.reservedAttributeName];
    delete parentDataObject[oldName];
    parentDataObject[valueObject[JsonSchema.reservedAttributeName]] = valueObject[JsonSchema.reservedAttributeValue];


    console.log('dataObject');
    console.log(dataObject);
    console.log('parentDataObject');
    console.log(parentDataObject);
    console.log('valueObject');
    console.log(valueObject);
    console.log('currentIndex');
    console.log(currentIndex);

  }





  private setDataPathValueRecursively(dataObject: InstanceExtractData, parentDataObject: InstanceExtractData, component: CedarComponent, multiInstanceObjectService: MultiInstanceObjectHandler, path: string[], valueObject: object): void {
    if (path.length === 0) {
      if (component instanceof SingleFieldComponent) {
        this.injectValue(dataObject, valueObject);
      } else {
        const multiField = component as MultiFieldComponent;
        const multiInstanceInfo: MultiInstanceObjectInfo = multiInstanceObjectService.getMultiInstanceInfoForComponent(multiField);
        const currentIndex = multiInstanceInfo.currentIndex;

        if (valueObject.hasOwnProperty(JsonSchema.reservedAttributeName)) {
          this.injectAttributeValue(dataObject, parentDataObject, valueObject, currentIndex);
        } else if (valueObject instanceof Array) {
          this.injectArrayValue(dataObject, valueObject);
        } else {
          this.injectValue(dataObject[currentIndex], valueObject);
        }
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

      this.setDataPathValueRecursively(dataSubObject, dataObject, childComponent, multiInstanceObjectService, remainingPath, valueObject);
    }
  }

  changeValue(dataContext: DataContext, component: FieldComponent, multiInstanceObjectService: MultiInstanceObjectHandler, value: string): void {
    const path = component.path;
    const valueObject = {};
    valueObject[JsonSchema.atValue] = value;
    this.setDataPathValueRecursively(dataContext.instanceExtractData, null, dataContext.templateRepresentation, multiInstanceObjectService, path, valueObject);
    this.setDataPathValueRecursively(dataContext.instanceFullData, null, dataContext.templateRepresentation, multiInstanceObjectService, path, valueObject);
  }

  changeListValue(dataContext: DataContext, component: FieldComponent, multiInstanceObjectService: MultiInstanceObjectHandler, value: string[]): void {
    const path = component.path;
    const valueArray = [];

    if (value.length === 0) {
      value = [null];
    }

    for (const val of value) {
      const obj = {};
      obj[JsonSchema.atValue] = val;
      valueArray.push(obj);
    }

    this.setDataPathValueRecursively(dataContext.instanceExtractData, null, dataContext.templateRepresentation, multiInstanceObjectService, path, valueArray);
    this.setDataPathValueRecursively(dataContext.instanceFullData, null, dataContext.templateRepresentation, multiInstanceObjectService, path, valueArray);
  }

  changeAttributeValue(dataContext: DataContext, component: FieldComponent,
                       multiInstanceObjectService: MultiInstanceObjectHandler, key: string, value: string): void {
    const path = component.path;
    const valueObject = {};
    const obj = {};

    if (value && value.length === 0) {
      value = null;
    }

    obj[JsonSchema.atValue] = value;
    valueObject[JsonSchema.reservedAttributeName] = key;
    valueObject[JsonSchema.reservedAttributeValue] = obj;

    this.setDataPathValueRecursively(dataContext.instanceExtractData, null, dataContext.templateRepresentation, multiInstanceObjectService, path, valueObject);
    this.setDataPathValueRecursively(dataContext.instanceFullData, null, dataContext.templateRepresentation, multiInstanceObjectService, path, valueObject);
  }

  changeControlledValue(dataContext: DataContext, component: FieldComponent, multiInstanceObjectService: MultiInstanceObjectHandler, atId: string, prefLabel: string): void {
    const path = component.path;
    const valueObject = {};

    if (atId) {
      valueObject[JsonSchema.atId] = atId;
      valueObject[JsonSchema.rdfsLabel] = prefLabel;
    }

    this.setDataPathValueRecursively(dataContext.instanceExtractData, null, dataContext.templateRepresentation, multiInstanceObjectService, path, valueObject);
    this.setDataPathValueRecursively(dataContext.instanceFullData, null, dataContext.templateRepresentation, multiInstanceObjectService, path, valueObject);
  }

}
