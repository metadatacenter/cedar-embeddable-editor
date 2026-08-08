import { TemplateComponent } from '../models/template/template-component.model';
import { ElementComponent } from '../models/component/element-component.model';
import { MultiComponent } from '../models/component/multi-component.model';
import { Injectable } from '@angular/core';
import { MultiFieldComponent } from '../models/field/multi-field-component.model';
import { SingleFieldComponent } from '../models/field/single-field-component.model';
import { MultiElementComponent } from '../models/element/multi-element-component.model';
import { SingleElementComponent } from '../models/element/single-element-component.model';
import { CedarComponent } from '../models/component/cedar-component.model';
import { CedarTemplate } from '../models/template/cedar-template.model';
import * as _ from 'lodash-es';
import { MultiInstanceInfo } from '../models/info/multi-instance-info.model';
import { MultiInstanceObjectInfo } from '../models/info/multi-instance-object-info.model';
import { InstanceExtractData } from '../models/instance-extract-data.model';
import { InstanceCardinalityReader } from './instance-cardinality-reader';
import { ModelLibraryInstanceReader } from './model-library-instance-reader';

@Injectable({
  providedIn: 'root',
})
export class MultiInstanceObjectHandler {
  private static readonly defaultInstanceReader: InstanceCardinalityReader = new ModelLibraryInstanceReader();

  public multiInstanceObject: MultiInstanceInfo;
  private templateRepresentation: TemplateComponent;

  /**
   * Resolves a component path in the live instance, through the current cursors.
   *
   * Installed by `HandlerContext`, which owns both the instance and the path
   * resolver. It is how `currentCount` stops being a number this handler
   * maintains and becomes a fact about the document — see
   * `MultiInstanceObjectInfo`.
   *
   * There is no cycle to worry about: resolving a path reads each multi
   * ancestor's `currentIndex`, never its count.
   */
  private resolveInstanceNode: ((path: string[]) => unknown) | null = null;
  private indexRegEx = new RegExp(/@#index\[(\d+)\]#@/);

  private static getNodeByPath(obj, arrPath: string[]): object {
    let val: object;

    for (let i = 0; i < arrPath.length; i++) {
      if (val) {
        val = val[arrPath[i]];
      } else {
        val = obj[arrPath[i]];
      }
    }
    return val;
  }

  private static getMultiInstanceInfoNodeByPath(obj, arrPath: string[]): MultiInstanceInfo {
    return MultiInstanceObjectHandler.getNodeByPath(obj, arrPath) as MultiInstanceInfo;
  }

  private static getMultiInstanceObjectInfoNodeByPath(obj, arrPath: string[]): MultiInstanceObjectInfo {
    return MultiInstanceObjectHandler.getNodeByPath(obj, arrPath) as MultiInstanceObjectInfo;
  }

  setInstanceResolver(resolve: (path: string[]) => unknown): void {
    this.resolveInstanceNode = resolve;
  }

  /** How many occurrences the instance actually holds at this path. */
  private countInInstance(path: string[]): number {
    if (!this.resolveInstanceNode) {
      return 0;
    }
    const node = this.resolveInstanceNode(path);
    return Array.isArray(node) ? node.length : 0;
  }

  buildNewOrFromMetadata(
    templateRepresentation: TemplateComponent,
    instance: InstanceExtractData = null,
    instanceReader: InstanceCardinalityReader = MultiInstanceObjectHandler.defaultInstanceReader,
  ): MultiInstanceInfo {
    instanceReader = instanceReader ?? MultiInstanceObjectHandler.defaultInstanceReader;
    this.templateRepresentation = templateRepresentation;
    this.multiInstanceObject = new MultiInstanceInfo();
    this.buildRecursively(templateRepresentation, this.multiInstanceObject);

    if (instance) {
      // The template gave us a skeleton at each component's `minItems`; the
      // instance says what is actually there, and wins.
      instanceReader.read(instance, (path, count) =>
        this.setSingleMultiInstance(path, count, this.multiInstanceObject),
      );
    }
    return this.multiInstanceObject;
  }

  private setSingleMultiInstance(path: string[], count: number, multiInstanceObject: MultiInstanceInfo): void {
    const pathCopy = [];
    for (let i = 0; i < path.length; i++) {
      pathCopy.push(path[i]);
      const match = path[i].match(this.indexRegEx);

      if (match && match.length > 1) {
        pathCopy.pop();
        const pathParent = pathCopy.slice();
        pathCopy.push('children');
        pathCopy.push(match[1]);

        const childObj = MultiInstanceObjectHandler.getMultiInstanceInfoNodeByPath(multiInstanceObject, pathCopy);
        const componentName = path[i + 1];

        // childObj is an object of type MultiInstanceInfo of structure
        // {strKey1 => MultiInstanceObjectInfo, strKey2 => MultiInstanceObjectInfo}
        if (childObj) {
          const arrayElemPath = pathCopy.slice();
          arrayElemPath.push(componentName);
          const arrayElem = MultiInstanceObjectHandler.getMultiInstanceObjectInfoNodeByPath(
            multiInstanceObject,
            arrayElemPath,
          );

          // the child object (element of the array) does exist
          // but the element inside it does not, creating base
          if (!arrayElem) {
            const childElem = new MultiInstanceObjectInfo();
            childElem.componentName = componentName;
            childObj.addChild(childElem);
          }
        } else {
          // the entire child object (element of the array) does not exist
          // need to create the object and its first base element
          const parentObj = MultiInstanceObjectHandler.getMultiInstanceObjectInfoNodeByPath(
            multiInstanceObject,
            pathParent,
          );
          if (parentObj) {
            const child = new MultiInstanceInfo();
            parentObj.addChild(child);
            const childElem = new MultiInstanceObjectInfo();
            childElem.componentName = componentName;
            child.addChild(childElem);
          }
        }
      }
    }

    const targetObj = MultiInstanceObjectHandler.getMultiInstanceObjectInfoNodeByPath(multiInstanceObject, pathCopy);
    if (targetObj) {
      targetObj.componentName = path[path.length - 1];
      targetObj.currentCount = count;
      targetObj.currentIndex = count > 0 ? 0 : -1;
    }
  }

  private buildRecursively(cedarComponent: CedarComponent, multiInstanceObject: MultiInstanceInfo): void {
    if (
      !(
        cedarComponent instanceof MultiElementComponent ||
        cedarComponent instanceof SingleElementComponent ||
        cedarComponent instanceof CedarTemplate
      )
    ) {
      return;
    }
    const elementComponent = cedarComponent as ElementComponent;
    for (const child of elementComponent.children) {
      const name = child.name;
      const multiInfo = new MultiInstanceObjectInfo();
      multiInfo.componentName = name;
      // The count comes from the instance from here on. Only multi components
      // have an array to count; a single field or element is always one, and
      // stays a stored number.
      if (child instanceof MultiFieldComponent || child instanceof MultiElementComponent) {
        const childPath = child.path;
        multiInfo.countSupplier = () => this.countInInstance(childPath);
      }
      multiInstanceObject.addChild(multiInfo);
      let count = 0;
      let currentIndex = -1;
      if (child instanceof MultiFieldComponent) {
        count = (child as MultiComponent).multiInfo.minItems;
        currentIndex = count > 0 ? 0 : -1;
        /// delete multiInfo.children;
      } else if (child instanceof SingleFieldComponent) {
        count = 1;
        currentIndex = -1;
        /// delete multiInfo.children;
      } else if (child instanceof MultiElementComponent) {
        count = (child as MultiComponent).multiInfo.minItems;
        currentIndex = count > 0 ? 0 : -1;
        for (let i = 0; i < count; i++) {
          const mc = new MultiInstanceInfo();
          this.buildRecursively(child, mc);
          multiInfo.addChild(mc);
        }
      } else if (child instanceof SingleElementComponent) {
        count = 1;
        currentIndex = -1;
        const mc = new MultiInstanceInfo();
        this.buildRecursively(child, mc);
        multiInfo.addChild(mc);
      }
      multiInfo.currentCount = count;
      multiInfo.currentIndex = currentIndex;
    }
  }

  setCurrentIndex(component: MultiComponent, currentIdx: number): void {
    const multiInstanceInfo: MultiInstanceObjectInfo = this.getDataPathNode(component.path);
    multiInstanceInfo.currentIndex = currentIdx;
  }

  multiInstanceItemAdd(component: MultiComponent): void {
    const multiInstanceInfo: MultiInstanceObjectInfo = this.getDataPathNode(component.path);

    if (component instanceof MultiElementComponent) {
      const newMultiInstanceObject: MultiInstanceInfo = new MultiInstanceInfo();
      this.buildRecursively(component, newMultiInstanceObject);
      multiInstanceInfo.children.splice(multiInstanceInfo.currentIndex + 1, 0, newMultiInstanceObject as never);
    }
    // No `currentCount++`: the instance was spliced before this ran, and the
    // count is read from it.
    multiInstanceInfo.currentIndex++;
  }

  multiInstanceItemCopy(component: MultiComponent): void {
    const multiInstanceInfo = this.getDataPathNode(component.path);

    if (component instanceof MultiElementComponent) {
      const currentIdx = multiInstanceInfo.currentIndex;
      const sourceItem = multiInstanceInfo.children[currentIdx];
      const cloneItem = _.cloneDeep(sourceItem);
      multiInstanceInfo.children.splice(currentIdx + 1, 0, cloneItem as never);
    }
    multiInstanceInfo.currentIndex++;
  }

  multiInstanceItemDelete(component: MultiComponent): void {
    const multiInstanceInfo = this.getDataPathNode(component.path);

    if (component instanceof MultiElementComponent) {
      const currentIdx = multiInstanceInfo.currentIndex;
      multiInstanceInfo.children.splice(currentIdx, 1);
    }
    // The cursor may now point past the end. `currentCount` already reflects the
    // splice, because it reads the instance and the instance was spliced first.
    if (multiInstanceInfo.currentIndex > multiInstanceInfo.currentCount - 1) {
      multiInstanceInfo.currentIndex = multiInstanceInfo.currentCount - 1;
    }
  }

  getMultiInstanceInfoForComponent(component: MultiComponent): MultiInstanceObjectInfo {
    return this.getDataPathNode(component.path);
  }

  public getDataPathNode(path: string[]): MultiInstanceObjectInfo {
    return this.getDataPathNodeRecursively(this.multiInstanceObject, this.templateRepresentation, path);
  }

  private getDataPathNodeRecursively(
    multiInstanceObject: MultiInstanceInfo,
    component: CedarComponent,
    path: string[],
  ): MultiInstanceObjectInfo {
    if (!multiInstanceObject) {
      return null;
    }
    const firstPath = path[0];
    const remainingPath = path.slice(1);
    let childComponent: CedarComponent = null;
    let childMultiInfo: MultiInstanceObjectInfo = null;
    if (component instanceof SingleElementComponent) {
      childComponent = (component as SingleElementComponent).getChildByName(firstPath);
      childMultiInfo = multiInstanceObject.getChildByName(firstPath);
    } else if (component instanceof CedarTemplate) {
      childComponent = (component as CedarTemplate).getChildByName(firstPath);
      childMultiInfo = multiInstanceObject.getChildByName(firstPath);
    } else if (component instanceof MultiElementComponent) {
      childComponent = (component as MultiElementComponent).getChildByName(firstPath);
      childMultiInfo = multiInstanceObject.getChildByName(firstPath);
    }

    if (remainingPath.length === 0) {
      return childMultiInfo;
    } else {
      let goIdx = 0;
      if (childMultiInfo.currentIndex > 0) {
        goIdx = childMultiInfo.currentIndex;
      }
      return this.getDataPathNodeRecursively(childMultiInfo.children[goIdx], childComponent, remainingPath);
    }
  }

  hasMultiInstances(multiComponent: MultiComponent): boolean {
    const multiInstanceObjectInfo: MultiInstanceObjectInfo = this.getMultiInstanceInfoForComponent(multiComponent);
    return multiInstanceObjectInfo.currentCount > 0;
  }
}
