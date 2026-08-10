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
import { InstanceObject } from '../models/instance-node.model';
import { InstanceCardinalityReader } from './instance-cardinality-reader';
import { ModelLibraryInstanceReader } from './model-library-instance-reader';
import { InstanceDataAttributeValueField } from 'cedar-model-typescript-library';

@Injectable({
  providedIn: 'root',
})
export class MultiInstanceObjectHandler {
  private static readonly defaultInstanceReader: InstanceCardinalityReader = new ModelLibraryInstanceReader();

  /** An empty info tree until a template is built into one, which is CEE's starting state. */
  public multiInstanceObject: MultiInstanceInfo = new MultiInstanceInfo();
  private templateRepresentation: TemplateComponent | null = null;

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

  /**
   * Walk the multi-instance info tree by component path.
   *
   * The tree is keyed by component name at every level, so a step is a lookup on
   * whatever the previous step returned. Typed as the record it is rather than as
   * `object`, which is what let the two callers below assert their way to a result.
   */
  private static getNodeByPath(obj: MultiInstanceInfo, arrPath: string[]): unknown {
    let val: unknown = obj;

    for (const step of arrPath) {
      if (val === null || typeof val !== 'object') {
        return undefined;
      }
      val = (val as Record<string, unknown>)[step];
    }
    return val;
  }

  private static getMultiInstanceInfoNodeByPath(obj: MultiInstanceInfo, arrPath: string[]): MultiInstanceInfo {
    return MultiInstanceObjectHandler.getNodeByPath(obj, arrPath) as MultiInstanceInfo;
  }

  private static getMultiInstanceObjectInfoNodeByPath(
    obj: MultiInstanceInfo,
    arrPath: string[],
  ): MultiInstanceObjectInfo {
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
    if (Array.isArray(node)) {
      return node.length;
    }
    /*
     * An attribute-value field is the exception, and only once it has been read
     * back: the reader folds a list of attribute names into a single node keyed
     * by name, so the occurrences are its names rather than a list's length.
     * While the tree was a document there was nothing to fold into and every
     * field counted the same way, so a reloaded instance reported no attributes
     * at all and the pager offered no pages.
     */
    if (node instanceof InstanceDataAttributeValueField) {
      return Object.keys(node.values).length;
    }
    return 0;
  }

  buildNewOrFromMetadata(
    templateRepresentation: TemplateComponent,
    /** The instance root, which is a JSON-LD document and so always an object. */
    instance: InstanceObject | null = null,
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
        count = (child as MultiComponent).multiInfo.getSafeMinItems();
        currentIndex = count > 0 ? 0 : -1;
        /// delete multiInfo.children;
      } else if (child instanceof SingleFieldComponent) {
        count = 1;
        currentIndex = -1;
        /// delete multiInfo.children;
      } else if (child instanceof MultiElementComponent) {
        count = (child as MultiComponent).multiInfo.getSafeMinItems();
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
    const multiInstanceInfo = this.getDataPathNode(component.path);
    if (multiInstanceInfo === null) {
      return;
    }
    multiInstanceInfo.currentIndex = currentIdx;
  }

  multiInstanceItemAdd(component: MultiComponent): void {
    const multiInstanceInfo = this.getDataPathNode(component.path);
    if (multiInstanceInfo === null) {
      return;
    }

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
    if (multiInstanceInfo === null) {
      return;
    }

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
    if (multiInstanceInfo === null) {
      return;
    }

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

  /*
   * Both return null for a component the info tree has no node for — a path into a
   * template that has since been replaced, say. Every caller already tests the
   * result, which is what the declaration now says.
   */
  getMultiInstanceInfoForComponent(component: MultiComponent): MultiInstanceObjectInfo | null {
    return this.getDataPathNode(component.path);
  }

  public getDataPathNode(path: string[]): MultiInstanceObjectInfo | null {
    return this.getDataPathNodeRecursively(this.multiInstanceObject, this.templateRepresentation, path);
  }

  private getDataPathNodeRecursively(
    multiInstanceObject: MultiInstanceInfo,
    /*
     * Nullable, as in the matching walk in `DataObjectStructureHandler`. It is null
     * before a template is set, which is the state CEE starts in and the state a
     * host can return it to. None of the three `instanceof` branches below matches
     * null, so `childComponent` stays null and the walk ends where it stands —
     * which is the answer, not an oversight to guard against at the top.
     */
    component: CedarComponent | null,
    path: string[],
  ): MultiInstanceObjectInfo | null {
    if (!multiInstanceObject) {
      return null;
    }
    const firstPath = path[0];
    const remainingPath = path.slice(1);
    let childComponent: CedarComponent | null = null;
    let childMultiInfo: MultiInstanceObjectInfo | null = null;
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
    }
    // A path step naming a child that the component or the info tree does not have
    // ends the walk, which is the same `null` the empty-tree case above returns.
    if (childMultiInfo === null || childComponent === null) {
      return null;
    }
    const goIdx = childMultiInfo.currentIndex > 0 ? childMultiInfo.currentIndex : 0;
    return this.getDataPathNodeRecursively(childMultiInfo.children[goIdx], childComponent, remainingPath);
  }

  hasMultiInstances(multiComponent: MultiComponent): boolean {
    // A component with no node in the info tree has no occurrences, which is the
    // same answer as a node reporting a count of zero.
    return (this.getMultiInstanceInfoForComponent(multiComponent)?.currentCount ?? 0) > 0;
  }
}
