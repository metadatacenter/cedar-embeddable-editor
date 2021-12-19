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
import {CedarModel} from '../models/cedar-model.model';
import {DataObjectUtil} from '../util/data-object-util';

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

  private injectAttributeValue(dataObject: InstanceExtractData, currentIndex: number, parentDataObject: InstanceExtractData,
                               component: CedarComponent, valueObject: object): void {
    const oldName = dataObject[currentIndex];
    let newName = valueObject[JsonSchema.reservedAttributeName];

    if (!newName || this.isDuplicateAttributeName(newName, dataObject, parentDataObject, currentIndex)) {
      newName = this.getDefaultAttributeName(dataObject, parentDataObject, currentIndex);
    }

    const oldNameIndex = (dataObject as Array<string>).indexOf(oldName);
    dataObject[currentIndex] = newName;
    const needsDeleting = (oldName && newName !== oldName && oldNameIndex === currentIndex);

    // if (oldName && newName !== oldName && oldNameIndex === currentIndex) {
    if (needsDeleting) {
      // console.log('deleting parent old name entry: ' + oldName);
      delete parentDataObject[oldName];
    }

    parentDataObject[newName] = valueObject[JsonSchema.reservedAttributeValue];



    // console.log('-----------------------------------');
    // console.log('old name: ' + JSON.stringify(oldName));
    // console.log('new name after it was set from null: ' + newName);
    // console.log('dataObject after');
    // console.log(JSON.parse(JSON.stringify(dataObject)));
    // console.log('parentDataObject after');
    // console.log(JSON.parse(JSON.stringify(parentDataObject)));
    // console.log('-----------------------------------');




    if (parentDataObject.hasOwnProperty(JsonSchema.atContext)) {
      if (parentDataObject[JsonSchema.atContext].hasOwnProperty(component.name)) {
        delete parentDataObject[JsonSchema.atContext][component.name];
      }

      let elemId = '';

      // if (oldName && newName !== oldName && oldNameIndex === currentIndex) {
      if (needsDeleting) {
        elemId = parentDataObject[JsonSchema.atContext][oldName];
        delete parentDataObject[JsonSchema.atContext][oldName];
      }

      if (!parentDataObject[JsonSchema.atContext].hasOwnProperty(newName)) {
        if (!elemId || elemId.length === 0) {
          elemId = CedarModel.baseTemplateURL + '/' +
            JsonSchema.properties + '/' + DataObjectUtil.generateGUID();
        }
        parentDataObject[JsonSchema.atContext][newName] = elemId;
      }
    }
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
          this.injectAttributeValue(dataObject, currentIndex, parentDataObject, component, valueObject);
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
      let parentDataSubObject = null;

      if (component instanceof SingleElementComponent) {
        childComponent = (component as SingleElementComponent).getChildByName(firstPath);
        dataSubObject = dataObject[firstPath];
        parentDataSubObject = dataObject;
      } else if (component instanceof CedarTemplate) {
        childComponent = (component as CedarTemplate).getChildByName(firstPath);
        dataSubObject = dataObject[firstPath];
        parentDataSubObject = dataObject;
      } else if (component instanceof MultiElementComponent) {
        const multiElement = component as MultiElementComponent;
        const multiInstanceInfo: MultiInstanceObjectInfo = multiInstanceObjectService.getMultiInstanceInfoForComponent(multiElement);
        const currentIndex = multiInstanceInfo.currentIndex;
        childComponent = multiElement.getChildByName(firstPath);
        dataSubObject = dataObject[currentIndex][firstPath];
        parentDataSubObject = dataObject[currentIndex];
      }

      this.setDataPathValueRecursively(dataSubObject, parentDataSubObject, childComponent, multiInstanceObjectService, remainingPath, valueObject);
    }
  }







  private isDuplicateAttributeName(name: string, dataObject: InstanceExtractData, parentDataObject: InstanceExtractData, currentIndex: number): boolean {
    // console.log('-----------------------------------');
    // console.log('name: ' + name);
    // console.log('dataObject');
    // console.log(JSON.parse(JSON.stringify(dataObject)));
    // console.log('parentDataObject');
    // console.log(JSON.parse(JSON.stringify(parentDataObject)));
    // console.log('currentIndex: ' + currentIndex);
    // console.log('-----------------------------------');

    const ind = (dataObject as Array<string>).indexOf(name);
    return (ind > -1 && ind !== currentIndex); // || name.toLowerCase() === component.name.toLowerCase();
  }

  private getDefaultAttributeName(dataObject: InstanceExtractData, parentDataObject: InstanceExtractData, currentIndex: number): string {
    let nameIndex = currentIndex + 1;
    let defName = JsonSchema.reservedDefaultAttributeName + nameIndex;

    while (this.isDuplicateAttributeName(defName, dataObject, parentDataObject, currentIndex) && nameIndex < 1000) {
      nameIndex++;
      defName = JsonSchema.reservedDefaultAttributeName + nameIndex;
    }

    return defName;
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

  deleteAttributeValue(dataContext: DataContext, component: FieldComponent,
                       multiInstanceObjectService: MultiInstanceObjectHandler, key: string): void {
    console.log('deleting attribute value data');
    console.log('-----------------------------------');
    console.log('dataContext');
    console.log(JSON.parse(JSON.stringify(dataContext)));
    console.log('-----------------------------------');
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
