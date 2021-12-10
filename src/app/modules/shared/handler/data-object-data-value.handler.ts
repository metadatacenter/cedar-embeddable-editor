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

      if (valueObject[JsonSchema.atValue] instanceof Array) {
        (target as Array<any>).length = 0;
        (target as Array<any>).push(...valueObject[JsonSchema.atValue]);
      } else {
        target[JsonSchema.atValue] = valueObject[JsonSchema.atValue];
      }



    } else {
      delete target[JsonSchema.atValue];
      target[JsonSchema.atId] = valueObject[JsonSchema.atId];
      target[JsonSchema.rdfsLabel] = valueObject[JsonSchema.rdfsLabel];
    }
  }






  private setDataPathValueRecursively(dataObject: InstanceExtractData, component: CedarComponent, multiInstanceObjectService: MultiInstanceObjectHandler, path: string[], valueObject: object): void {
    if (path.length === 0) {

      // console.log(dataObject);
      // console.log(valueObject);


      if (component instanceof SingleFieldComponent) {



        // console.log('SingleFieldComponent');
        // console.log(component);


        this.injectValue(dataObject, valueObject);
      } else {


        const multiField = component as MultiFieldComponent;
        const multiInstanceInfo: MultiInstanceObjectInfo = multiInstanceObjectService.getMultiInstanceInfoForComponent(multiField);
        const currentIndex = multiInstanceInfo.currentIndex;


        // console.log('MultiFieldComponent');
        // console.log(dataObject);
        // console.log(multiInstanceInfo);


        if (valueObject.hasOwnProperty(JsonSchema.atValue) && valueObject[JsonSchema.atValue] instanceof Array) {
          this.injectValue(dataObject, valueObject);
        } else {
          this.injectValue(dataObject[currentIndex], valueObject);
        }



      }
    } else {


      // console.log(component);


      const firstPath = path[0];
      const remainingPath = path.slice(1);
      let childComponent: CedarComponent = null;
      let dataSubObject = null;
      if (component instanceof SingleElementComponent) {
        childComponent = (component as SingleElementComponent).getChildByName(firstPath);

        // console.log('SingleElementComponent');
        // console.log(childComponent);


        dataSubObject = dataObject[firstPath];
      } else if (component instanceof CedarTemplate) {
        childComponent = (component as CedarTemplate).getChildByName(firstPath);
        dataSubObject = dataObject[firstPath];
      } else if (component instanceof MultiElementComponent) {




        const multiElement = component as MultiElementComponent;
        const multiInstanceInfo: MultiInstanceObjectInfo = multiInstanceObjectService.getMultiInstanceInfoForComponent(multiElement);
        const currentIndex = multiInstanceInfo.currentIndex;
        childComponent = multiElement.getChildByName(firstPath);


        // console.log('MultiElementComponent');
        // console.log(childComponent);


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

  changeListValue(dataContext: DataContext, component: FieldComponent, multiInstanceObjectService: MultiInstanceObjectHandler, value: string[]): void {
    const path = component.path;
    const valueObject = [];
    const valueArray = [];

    if (value.length === 0) {
      value = [null];
    }

    for (const val of value) {
      const obj = {};
      obj[JsonSchema.atValue] = val;
      valueArray.push(obj);
    }
    valueObject[JsonSchema.atValue] = valueArray;
    this.setDataPathValueRecursively(dataContext.instanceExtractData, dataContext.templateRepresentation, multiInstanceObjectService, path, valueObject);
    this.setDataPathValueRecursively(dataContext.instanceFullData, dataContext.templateRepresentation, multiInstanceObjectService, path, valueObject);
  }

  changeControlledValue(dataContext: DataContext, component: FieldComponent, multiInstanceObjectService: MultiInstanceObjectHandler, atId: string, prefLabel: string): void {
    const path = component.path;
    const valueObject = {};

    if (atId) {
      valueObject[JsonSchema.atId] = atId;
      valueObject[JsonSchema.rdfsLabel] = prefLabel;
    }

    this.setDataPathValueRecursively(dataContext.instanceExtractData, dataContext.templateRepresentation, multiInstanceObjectService, path, valueObject);
    this.setDataPathValueRecursively(dataContext.instanceFullData, dataContext.templateRepresentation, multiInstanceObjectService, path, valueObject);
  }

}
