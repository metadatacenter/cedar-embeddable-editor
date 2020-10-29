import {TemplateComponent} from '../models/template/template-component.model';
import {CedarComponent} from '../models/component/cedar-component.model';
import {SingleElementComponent} from '../models/element/single-element-component.model';
import {MultiElementComponent} from '../models/element/multi-element-component.model';
import {CedarTemplate} from '../models/template/cedar-template.model';
import {ElementComponent} from '../models/component/element-component.model';
import {SingleFieldComponent} from '../models/field/single-field-component.model';
import {MultiFieldComponent} from '../models/field/multi-field-component.model';
import {FieldComponent} from '../models/component/field-component.model';
import {JsonSchema} from '../models/json-schema.model';
import * as _ from 'lodash-es';
import {MultiComponent} from '../models/component/multi-component.model';

export class DataObjectService {

  private dataObject: object;
  private templateRepresentation: TemplateComponent;

  buildNew(templateRepresentation: TemplateComponent): object {
    this.templateRepresentation = templateRepresentation;
    this.dataObject = {};
    if (templateRepresentation != null && templateRepresentation.children != null) {
      for (const childComponent of templateRepresentation.children) {
        this.buildRecursively(childComponent, this.dataObject);
      }
    }
    return this.dataObject;
  }

  private buildRecursively(component: CedarComponent, dataObject: object): void {
    let ret = null;
    if (component instanceof SingleElementComponent || component instanceof MultiElementComponent || component instanceof CedarTemplate) {
      const iterableComponent: ElementComponent = component as ElementComponent;
      const targetName = iterableComponent.name;
      if (component instanceof MultiElementComponent) {
        const multiElement: MultiElementComponent = component as MultiElementComponent;
        dataObject[targetName] = this.getEmptyList();
        if (multiElement.currentMultiInfo.count > 0) {
          const dummyTargetObject: object = this.getEmptyObject();
          for (const childComponent of iterableComponent.children) {
            this.buildRecursively(childComponent, dummyTargetObject);
          }
          for (let idx = 0; idx < multiElement.currentMultiInfo.count; idx++) {
            const clone = _.cloneDeep(dummyTargetObject as any);
            dataObject[targetName].push(clone);
          }
        }
      } else {
        dataObject[targetName] = this.getEmptyObject();
        for (const childComponent of iterableComponent.children) {
          this.buildRecursively(childComponent, dataObject[targetName]);
        }
      }
      ret = dataObject[targetName];
    }
    if (component instanceof SingleFieldComponent || component instanceof MultiFieldComponent) {
      const nonIterableComponent = component as FieldComponent;
      const targetName = nonIterableComponent.name;
      if (component instanceof MultiFieldComponent) {
        const multiField: MultiFieldComponent = component as MultiFieldComponent;
        dataObject[targetName] = this.getEmptyList();
        if (multiField.currentMultiInfo.count > 0) {
          for (let idx = 0; idx < multiField.currentMultiInfo.count; idx++) {
            dataObject[targetName].push(this.getEmptyValueWrapper());
          }
        }
      } else {
        dataObject[targetName] = this.getEmptyValueWrapper();
      }
      ret = dataObject[targetName];
    }
    return ret;
  }

  private getEmptyValueWrapper(): object {
    const obj = {};
    obj[JsonSchema.atValue] = '';
    return obj;
  }

  private getEmptyObject(): object {
    return {};
  }

  private getEmptyList(): [] {
    return [];
  }

  public setDataPathValue(component: CedarComponent, value: string): void {
    const path = component.path;
    this.setDataPathValueRecursively(this.dataObject, this.templateRepresentation, path, value);
  }

  private setDataPathValueRecursively(dataObject: object, component: CedarComponent, path: string[], value: string): void {
    if (path.length === 0) {
      if (component instanceof SingleFieldComponent) {
        dataObject[JsonSchema.atValue] = value;
      } else {
        const multiField = component as MultiFieldComponent;
        const currentIndex = multiField.currentMultiInfo.currentIndex;
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
        const currentIndex = multiElement.currentMultiInfo.currentIndex;
        childComponent = multiElement.getChildByName(firstPath);
        dataSubObject = dataObject[currentIndex][firstPath];
        // } else {
        //   childComponent = component;
      }
      this.setDataPathValueRecursively(dataSubObject, childComponent, remainingPath, value);
    }
  }

  public getDataPathNode(path: string[]): object {
    return this.getDataPathNodeRecursively(this.dataObject, this.templateRepresentation, path);
  }

  private getDataPathNodeRecursively(dataObject: object, component: CedarComponent, path: string[]): object {
    if (path.length === 0) {
      return dataObject;
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
        const currentIndex = multiElement.currentMultiInfo.currentIndex;
        childComponent = multiElement.getChildByName(firstPath);
        dataSubObject = dataObject[currentIndex][firstPath];
        // } else {
        //   childComponent = component;
      }
      return this.getDataPathNodeRecursively(dataSubObject, childComponent, remainingPath);
    }
  }

  multiInstanceItemDelete(component: MultiComponent): void {
    const currentNodeAny = this.getDataPathNode(component.path);
    const currentNodeArray = currentNodeAny as [];
    currentNodeArray.splice(component.currentMultiInfo.currentIndex, 1);
    component.currentMultiInfo.count--;
    if (component.currentMultiInfo.currentIndex > component.currentMultiInfo.count - 1) {
      component.currentMultiInfo.currentIndex = component.currentMultiInfo.count - 1;
    }
  }

  multiInstanceItemCopy(component: MultiComponent): void {
    const currentNodeAny = this.getDataPathNode(component.path);
    const currentNodeArray = currentNodeAny as [];
    const sourceItem = currentNodeArray[component.currentMultiInfo.currentIndex];
    const cloneItem = _.cloneDeep(sourceItem as any);
    currentNodeArray.splice(component.currentMultiInfo.currentIndex + 1, 0, cloneItem as never);
    component.currentMultiInfo.count++;
    if (component.currentMultiInfo.count === 1) {
      component.currentMultiInfo.currentIndex = 0;
    } else {
      component.currentMultiInfo.currentIndex++;
    }
  }

  multiInstanceItemAdd(component: MultiComponent): void {
    const dataObject = {};
    const cloneComponent = _.cloneDeep(component);
    this.setCurrentCountToMinRecursively(cloneComponent);
    cloneComponent.currentMultiInfo.count = 1;
    this.buildRecursively(cloneComponent, dataObject);
    const newDataObject = dataObject[component.name][0];
    const currentNodeAny = this.getDataPathNode(component.path);
    const currentNodeArray = currentNodeAny as [];
    currentNodeArray.splice(component.currentMultiInfo.currentIndex + 1, 0, newDataObject as never);
    component.currentMultiInfo.count++;
    if (component.currentMultiInfo.count === 1) {
      component.currentMultiInfo.currentIndex = 0;
    } else {
      component.currentMultiInfo.currentIndex++;
    }
  }

  setCurrentCountToMinRecursively(component: CedarComponent): void {
    if (component instanceof SingleElementComponent) {
      const singleElement: SingleElementComponent = component as SingleElementComponent;
      for (const childComponent of singleElement.children) {
        this.setCurrentCountToMinRecursively(childComponent);
      }
    } else if (component instanceof MultiElementComponent) {
      const multiElement: MultiElementComponent = component as MultiElementComponent;
      multiElement.currentMultiInfo.count = multiElement.multiInfo.getSafeMinItems();
      for (const childComponent of multiElement.children) {
        this.setCurrentCountToMinRecursively(childComponent);
      }
    } else if (component instanceof MultiFieldComponent) {
      const multiField: MultiFieldComponent = component as MultiFieldComponent;
      multiField.currentMultiInfo.count = multiField.multiInfo.getSafeMinItems();
    }
  }

}
