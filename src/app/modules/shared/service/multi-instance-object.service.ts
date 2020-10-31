import {TemplateComponent} from '../models/template/template-component.model';
import {ElementComponent} from '../models/component/element-component.model';
import {MultiComponent} from '../models/component/multi-component.model';
import {Injectable} from '@angular/core';
import {MultiFieldComponent} from '../models/field/multi-field-component.model';
import {SingleFieldComponent} from '../models/field/single-field-component.model';
import {MultiElementComponent} from '../models/element/multi-element-component.model';
import {SingleElementComponent} from '../models/element/single-element-component.model';
import {CedarComponent} from '../models/component/cedar-component.model';
import {CedarTemplate} from '../models/template/cedar-template.model';
import * as _ from 'lodash-es';

@Injectable({
  providedIn: 'root',
})
export class MultiInstanceObjectService {

  static CHILDREN = 'children';
  static CURRENT_INDEX = 'currentIndex';
  static CURRENT_COUNT = 'currentCount';

  private multiInstanceObject: object;
  private templateRepresentation: TemplateComponent;

  buildNew(templateRepresentation: TemplateComponent): object {
    this.templateRepresentation = templateRepresentation;
    this.multiInstanceObject = {};
    this.buildRecursively(templateRepresentation, this.multiInstanceObject);
    return this.multiInstanceObject;
  }

  private buildRecursively(cedarComponent: CedarComponent, multiInstanceObject: object): void {
    if (!(cedarComponent instanceof MultiElementComponent || cedarComponent instanceof SingleElementComponent
      || cedarComponent instanceof CedarTemplate)) {
      return;
    }
    const elementComponent = cedarComponent as ElementComponent;
    for (const child of elementComponent.children) {
      const name = child.name;
      multiInstanceObject[name] = {};
      let count = 0;
      let currentIndex = -1;
      if (child instanceof MultiFieldComponent) {
        count = (child as MultiComponent).currentMultiInfo.count;
        currentIndex = count > 0 ? 0 : -1;
      } else if (child instanceof SingleFieldComponent) {
        count = 1;
        currentIndex = -1;
      } else if (child instanceof MultiElementComponent) {
        count = (child as MultiComponent).currentMultiInfo.count;
        currentIndex = count > 0 ? 0 : -1;
        multiInstanceObject[name][MultiInstanceObjectService.CHILDREN] = [];
        for (let i = 0; i < count; i++) {
          const mc = {};
          this.buildRecursively(child, mc);
          multiInstanceObject[name][MultiInstanceObjectService.CHILDREN].push(mc);
        }
      } else if (child instanceof SingleElementComponent) {
        count = 1;
        currentIndex = -1;
        multiInstanceObject[name][MultiInstanceObjectService.CHILDREN] = [];
        const mc = {};
        this.buildRecursively(child, mc);
        multiInstanceObject[name][MultiInstanceObjectService.CHILDREN].push(mc);
      }
      multiInstanceObject[name][MultiInstanceObjectService.CURRENT_COUNT] = count;
      multiInstanceObject[name][MultiInstanceObjectService.CURRENT_INDEX] = currentIndex;
    }
  }

  setCurrentIndex(component: MultiComponent, currentIdx: number): void {
    const currentNodeAny = this.getDataPathNode(component.path);
    currentNodeAny[MultiInstanceObjectService.CURRENT_INDEX] = currentIdx;
  }

  multiInstanceItemAdd(component: MultiComponent): void {
    const currentNodeAny = this.getDataPathNode(component.path);

    if (component instanceof MultiElementComponent) {
      const newMultiInstanceObject = {};
      this.buildRecursively(component, newMultiInstanceObject);
      const currentNodeArray = currentNodeAny[MultiInstanceObjectService.CHILDREN] as [];
      currentNodeArray.splice(currentNodeAny[MultiInstanceObjectService.CURRENT_INDEX] + 1, 0, newMultiInstanceObject as never);
    }

    currentNodeAny[MultiInstanceObjectService.CURRENT_INDEX]++;
    currentNodeAny[MultiInstanceObjectService.CURRENT_COUNT]++;
  }

  multiInstanceItemCopy(component: MultiComponent): void {
    const currentNodeAny = this.getDataPathNode(component.path);

    if (component instanceof MultiElementComponent) {
      const currentNodeArray = currentNodeAny[MultiInstanceObjectService.CHILDREN] as [];
      const currentIdx = currentNodeAny[MultiInstanceObjectService.CURRENT_INDEX];
      const sourceItem = currentNodeArray[currentIdx];
      const cloneItem = _.cloneDeep(sourceItem as any);
      currentNodeArray.splice(currentIdx + 1, 0, cloneItem as never);
    }

    currentNodeAny[MultiInstanceObjectService.CURRENT_INDEX]++;
    currentNodeAny[MultiInstanceObjectService.CURRENT_COUNT]++;
  }

  multiInstanceItemDelete(component: MultiComponent): void {
    const currentNodeAny = this.getDataPathNode(component.path);

    if (component instanceof MultiElementComponent) {
      const currentNodeArray = currentNodeAny[MultiInstanceObjectService.CHILDREN] as [];
      const currentIdx = currentNodeAny[MultiInstanceObjectService.CURRENT_INDEX];
      currentNodeArray.splice(currentIdx, 1);
    }
    currentNodeAny[MultiInstanceObjectService.CURRENT_COUNT]--;
    if (currentNodeAny[MultiInstanceObjectService.CURRENT_INDEX] > currentNodeAny[MultiInstanceObjectService.CURRENT_COUNT] - 1) {
      currentNodeAny[MultiInstanceObjectService.CURRENT_INDEX] = currentNodeAny[MultiInstanceObjectService.CURRENT_COUNT] - 1;
    }
  }

  public getDataPathNode(path: string[]): object {
    return this.getDataPathNodeRecursively(this.multiInstanceObject, this.templateRepresentation, path);
  }

  private getDataPathNodeRecursively(multiInstanceObject: object, component: CedarComponent, path: string[]): object {
    if (path.length === 0) {
      return multiInstanceObject;
    } else {
      const firstPath = path[0];
      const remainingPath = path.slice(1);
      let childComponent: CedarComponent = null;
      let dataSubObject = null;
      if (component instanceof SingleElementComponent) {
        childComponent = (component as SingleElementComponent).getChildByName(firstPath);
        dataSubObject = multiInstanceObject[firstPath];
      } else if (component instanceof CedarTemplate) {
        childComponent = (component as CedarTemplate).getChildByName(firstPath);
        dataSubObject = multiInstanceObject[firstPath];
      } else if (component instanceof MultiElementComponent) {
        const multiElement = component as MultiElementComponent;
        const currentIndex = multiInstanceObject[MultiInstanceObjectService.CURRENT_INDEX];
        childComponent = multiElement.getChildByName(firstPath);
        dataSubObject = multiInstanceObject[MultiInstanceObjectService.CHILDREN][currentIndex][firstPath];
      }
      return this.getDataPathNodeRecursively(dataSubObject, childComponent, remainingPath);
    }
  }

}
