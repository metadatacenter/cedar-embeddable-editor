import { MultiInstanceObjectInfo } from '../models/info/multi-instance-object-info.model';
import { CedarComponent } from '../models/component/cedar-component.model';
import { SingleElementComponent } from '../models/element/single-element-component.model';
import { CedarTemplate } from '../models/template/cedar-template.model';
import { MultiElementComponent } from '../models/element/multi-element-component.model';
import { DataContext } from '../util/data-context';
import { MultiInstanceObjectHandler } from './multi-instance-object.handler';
import { SingleFieldComponent } from '../models/field/single-field-component.model';
import { JsonSchema } from 'cedar-model-typescript-library';
import { MultiFieldComponent } from '../models/field/multi-field-component.model';
import { FieldComponent } from '../models/component/field-component.model';
import { InstanceExtractData } from '../models/instance-extract-data.model';
import {
  InstanceArray,
  InstanceNode,
  InstanceObject,
  isInstanceArray,
  isInstanceObject,
} from '../models/instance-node.model';
import { CedarModel } from 'cedar-model-typescript-library';
import { DataObjectUtil } from '../util/data-object-util';
import { valueIsIri } from '../models/ext-auth-categories.model';
import { InstanceValueNode } from '../util/instance-value-node';
import { MessageHandlerService } from '../service/message-handler.service';
import { InputType } from '../models/input-type.model';

/**
 * One step of the walk down to the node a value belongs in.
 *
 * This was an untyped `{}` with four `readonly *_KEY` constants existing only to
 * index it, and four local `const`s at each call site to hold those constants. The
 * keys were never referenced anywhere else. An interface says the same thing and
 * deletes all of it.
 */
interface DownstreamObjects {
  dataSubObject: InstanceNode;
  parentDataSubObject: InstanceNode;
  /** Null when the path names a child the component does not have. */
  childComponent: CedarComponent | null;
  remainingPath: string[];
}

export class DataObjectDataValueHandler {
  private messageHandlerService: MessageHandlerService;

  constructor(messageHandlerService: MessageHandlerService) {
    this.messageHandlerService = messageHandlerService;
  }

  private injectValue(target: InstanceExtractData, valueObject: InstanceObject, fullPath: string[]): void {
    if (target === null || target === undefined) {
      this.messageHandlerService.error('Unable to set missing data target:' + fullPath);
      return;
    }
    InstanceValueNode.overwrite(target, valueObject);
  }

  private injectArrayValue(target: InstanceExtractData, valueArray: InstanceNode[]): void {
    if (!isInstanceArray(target)) {
      this.messageHandlerService.error('Expected a list of occurrences to replace, found something else');
      return;
    }
    target.length = 0;
    target.push(...valueArray);
  }

  /*
   * Narrower than `InstanceExtractData` on both, because this is the one place that
   * knows the shape: an attribute-value field keeps its *names* in an array and the
   * values they name on the parent object. Saying so here is what lets everything
   * below index without a cast.
   */
  private injectAttributeValue(
    dataObject: InstanceArray,
    currentIndex: number,
    parentDataObject: InstanceObject,
    component: CedarComponent,
    valueObject: InstanceObject,
  ): void {
    /*
     * Narrowed rather than asserted. `JsonSchema.reservedAttributeName` is declared
     * `static … : string` in the model library rather than as a literal, so indexing
     * through it yields `InstanceNode` and no assertion could be checked. A `typeof`
     * test is checkable: a name that is not a string is treated as absent, which is
     * the same path a blank name already takes below.
     */
    const oldNameNode = dataObject[currentIndex];
    const oldName = typeof oldNameNode === 'string' ? oldNameNode : '';
    const suppliedName = valueObject[JsonSchema.reservedAttributeName];
    let newName = typeof suppliedName === 'string' ? suppliedName : '';

    if (!newName || this.isDuplicateAttributeName(newName, dataObject, parentDataObject, currentIndex)) {
      const supplied = newName;
      newName = this.getDefaultAttributeName(dataObject, parentDataObject, currentIndex);
      // A name the user actually typed has just been thrown away, because
      // another attribute on this object already uses it and two properties
      // cannot share a name. That is data loss, and it used to happen in
      // silence — the box simply changed under them.
      //
      // A *blank* name is not reported. The widget calls this on every
      // keystroke in either box, so empty is the state of every attribute the
      // moment it is created; complaining about it would put an error under the
      // field before the user had finished the first character.
      if (supplied) {
        this.messageHandlerService.error(
          `Attribute name "${supplied}" is already used on this object, so this one was renamed to "${newName}". ` +
            'Two attributes cannot share a name.',
        );
      }
    }

    const oldNameIndex = dataObject.indexOf(oldName);
    dataObject[currentIndex] = newName;
    const needsDeleting = oldName && newName !== oldName && oldNameIndex === currentIndex;

    if (needsDeleting) {
      // deleting parent old name entry
      delete parentDataObject[oldName];
    }

    parentDataObject[newName] = valueObject[JsonSchema.reservedAttributeValue];

    const context = parentDataObject[JsonSchema.atContext];
    if (isInstanceObject(context)) {
      if (Object.hasOwn(context, component.name)) {
        delete context[component.name];
      }

      let elemId = '';

      if (needsDeleting) {
        const existing = context[oldName];
        elemId = typeof existing === 'string' ? existing : '';
        delete context[oldName];
      }

      if (!Object.hasOwn(context, newName)) {
        if (!elemId || elemId.length === 0) {
          elemId = CedarModel.propertyIriPrefix + DataObjectUtil.generateGUID();
        }
        context[newName] = elemId;
      }
    }
  }

  private setDataPathValueRecursively(
    dataObject: InstanceExtractData,
    parentDataObject: InstanceExtractData,
    component: CedarComponent,
    multiInstanceObjectService: MultiInstanceObjectHandler,
    path: string[],
    valueObject: InstanceNode,
    fullPath: string[],
  ): void {
    if (path.length === 0) {
      if (component instanceof SingleFieldComponent) {
        if (isInstanceObject(valueObject)) {
          this.injectValue(dataObject, valueObject, fullPath);
        }
      } else {
        const multiField = component as MultiFieldComponent;
        const multiInstanceInfo: MultiInstanceObjectInfo | null =
          multiInstanceObjectService.getMultiInstanceInfoForComponent(multiField);
        const currentIndex = multiInstanceInfo?.currentIndex ?? 0;

        // Three shapes arrive here and the branch order is the discrimination: a
        // wrapper carrying a reserved attribute name, a list of occurrences, or a
        // single value wrapper destined for the current occurrence.
        if (isInstanceArray(valueObject)) {
          this.injectArrayValue(dataObject, valueObject);
        } else if (isInstanceObject(valueObject) && Object.hasOwn(valueObject, JsonSchema.reservedAttributeName)) {
          if (isInstanceArray(dataObject) && isInstanceObject(parentDataObject)) {
            this.injectAttributeValue(dataObject, currentIndex, parentDataObject, component, valueObject);
          }
        } else if (isInstanceObject(valueObject) && isInstanceArray(dataObject)) {
          this.injectValue(dataObject[currentIndex], valueObject, fullPath);
        }
      }
    } else {
      const downstream = this.getDownstreamObjects(dataObject, component, multiInstanceObjectService, path);
      if (downstream.childComponent === null) {
        return;
      }
      this.setDataPathValueRecursively(
        downstream.dataSubObject,
        downstream.parentDataSubObject,
        downstream.childComponent,
        multiInstanceObjectService,
        downstream.remainingPath,
        valueObject,
        fullPath,
      );
    }
  }

  private deleteAttributeValueRecursively(
    dataObject: InstanceExtractData,
    parentDataObject: InstanceExtractData,
    component: CedarComponent,
    multiInstanceObjectService: MultiInstanceObjectHandler,
    path: string[],
    valueObject: InstanceObject,
  ): void {
    if (path.length === 0) {
      if (!isInstanceObject(parentDataObject)) {
        this.messageHandlerService.error('Expected an object to delete an attribute from, found something else');
        return;
      }
      const nameNode = valueObject[JsonSchema.reservedAttributeName];
      if (typeof nameNode !== 'string') {
        return;
      }
      const name = nameNode;
      delete parentDataObject[name];

      const context = parentDataObject[JsonSchema.atContext];
      if (isInstanceObject(context)) {
        delete context[name];
      }
    } else {
      const downstream = this.getDownstreamObjects(dataObject, component, multiInstanceObjectService, path);
      if (downstream.childComponent === null) {
        return;
      }
      this.deleteAttributeValueRecursively(
        downstream.dataSubObject,
        downstream.parentDataSubObject,
        downstream.childComponent,
        multiInstanceObjectService,
        downstream.remainingPath,
        valueObject,
      );
    }
  }

  private getDownstreamObjects(
    dataObject: InstanceExtractData,
    component: CedarComponent,
    multiInstanceObjectService: MultiInstanceObjectHandler,
    path: string[],
  ): DownstreamObjects {
    const firstPath = path[0];
    const remainingPath = path.slice(1);
    let childComponent: CedarComponent | null = null;
    let dataSubObject: InstanceNode = null;
    let parentDataSubObject: InstanceNode = null;

    // A single element and a template both hold their children directly; a multi
    // element holds a list of occurrences and the child sits inside the current one.
    if (component instanceof SingleElementComponent || component instanceof CedarTemplate) {
      childComponent = component.getChildByName(firstPath);
      if (isInstanceObject(dataObject)) {
        dataSubObject = dataObject[firstPath];
      }
      parentDataSubObject = dataObject;
    } else if (component instanceof MultiElementComponent) {
      const multiInstanceInfo: MultiInstanceObjectInfo | null =
        multiInstanceObjectService.getMultiInstanceInfoForComponent(component);
      const currentIndex = multiInstanceInfo?.currentIndex ?? 0;
      childComponent = component.getChildByName(firstPath);
      const occurrence = isInstanceArray(dataObject) ? dataObject[currentIndex] : null;
      if (isInstanceObject(occurrence)) {
        dataSubObject = occurrence[firstPath];
      }
      parentDataSubObject = occurrence;
    }

    return { dataSubObject, parentDataSubObject, childComponent, remainingPath };
  }

  private isDuplicateAttributeName(
    name: string,
    dataObject: InstanceArray,
    parentDataObject: InstanceObject,
    currentIndex: number,
  ): boolean {
    const ind = dataObject.indexOf(name);

    // completely new name, check if parent object's names conflict
    if (ind < 0) {
      return Object.hasOwn(parentDataObject, name);
    }
    // name has not changed
    else if (ind === currentIndex) {
      return false;
    }
    // name changed but already exists in a different slot
    return true;
  }

  private getDefaultAttributeName(
    dataObject: InstanceArray,
    parentDataObject: InstanceObject,
    currentIndex: number,
  ): string {
    let nameIndex = currentIndex + 1;
    let defName = JsonSchema.reservedDefaultAttributeName + nameIndex;

    while (this.isDuplicateAttributeName(defName, dataObject, parentDataObject, currentIndex) && nameIndex < 1000) {
      nameIndex++;
      defName = JsonSchema.reservedDefaultAttributeName + nameIndex;
    }

    return defName;
  }

  changeValue(
    dataContext: DataContext,
    component: FieldComponent,
    multiInstanceObjectService: MultiInstanceObjectHandler,
    value: string | null,
  ): void {
    const path = component.path;
    const inputType = component.basicInfo.inputType;
    const iriValued = inputType !== null && valueIsIri(inputType as InputType);
    // An IRI-valued field cleared to null holds nothing at all, rather than an
    // `@id` of null — there is no such IRI. A literal carries the field's XSD
    // type in this full-copy tree, the same as the initial build attaches: a
    // numeric or temporal value keeps its `@type`, without which the server
    // rejects the instance on save.
    const valueObject = iriValued
      ? value === null
        ? {}
        : InstanceValueNode.iriJson(value)
      : InstanceValueNode.literalJson(value, DataObjectUtil.xsdTypeForFullCopy(component));
    const representation = dataContext.templateRepresentation;
    if (representation === null) {
      return;
    }
    dataContext.mutate((instance) =>
      this.setDataPathValueRecursively(
        instance,
        null,
        representation,
        multiInstanceObjectService,
        path,
        valueObject,
        path,
      ),
    );
  }

  changeListValue(
    dataContext: DataContext,
    component: FieldComponent,
    multiInstanceObjectService: MultiInstanceObjectHandler,
    value: string[] | null,
  ): void {
    const path = component.path;
    const valueArray: InstanceObject[] = [];

    // A cleared list is one empty slot, not no slots: the field still exists and
    // still has an occurrence to show. Held separately from `value` so the empty
    // case is a list of one null rather than a reassignment that widens the
    // parameter for everything below it.
    const values: (string | null)[] = !value || value.length === 0 ? [null] : value;

    for (const val of values) {
      valueArray.push(InstanceValueNode.literalJson(val));
    }

    const representation = dataContext.templateRepresentation;
    if (representation === null) {
      return;
    }
    dataContext.mutate((instance) =>
      this.setDataPathValueRecursively(
        instance,
        null,
        representation,
        multiInstanceObjectService,
        path,
        valueArray,
        path,
      ),
    );
  }

  changeAttributeValue(
    dataContext: DataContext,
    component: FieldComponent,
    multiInstanceObjectService: MultiInstanceObjectHandler,
    key: string | null,
    value: string | null,
  ): void {
    const path = component.path;
    const valueObject: InstanceObject = {};

    if (value && value.length === 0) {
      value = null;
    }

    // Through `InstanceValueNode` rather than assembled here. The shape of a
    // literal is the library's to decide, and this was the last place in the
    // handler that named `@value` itself.
    const obj: InstanceObject = InstanceValueNode.literalJson(value);
    valueObject[JsonSchema.reservedAttributeName] = key;
    valueObject[JsonSchema.reservedAttributeValue] = obj;

    const representation = dataContext.templateRepresentation;
    if (representation === null) {
      return;
    }
    dataContext.mutate((instance) =>
      this.setDataPathValueRecursively(
        instance,
        null,
        representation,
        multiInstanceObjectService,
        path,
        valueObject,
        path,
      ),
    );
  }

  deleteAttributeValue(
    dataContext: DataContext,
    component: FieldComponent,
    multiInstanceObjectService: MultiInstanceObjectHandler,
    key: string | null,
  ): void {
    if (!key) {
      return;
    }

    const path = component.path;
    const valueObject: InstanceObject = {};
    valueObject[JsonSchema.reservedAttributeName] = key;

    const representation = dataContext.templateRepresentation;
    if (representation === null) {
      return;
    }
    dataContext.mutate((instance) =>
      this.deleteAttributeValueRecursively(
        instance,
        null,
        representation,
        multiInstanceObjectService,
        path,
        valueObject,
      ),
    );
  }

  changeControlledValue(
    dataContext: DataContext,
    component: FieldComponent,
    multiInstanceObjectService: MultiInstanceObjectHandler,
    atId: string | null,
    prefLabel: string | null,
  ): void {
    const path = component.path;
    const valueObject = atId ? InstanceValueNode.iriJson(atId, prefLabel) : {};

    const representation = dataContext.templateRepresentation;
    if (representation === null) {
      return;
    }
    dataContext.mutate((instance) =>
      this.setDataPathValueRecursively(
        instance,
        null,
        representation,
        multiInstanceObjectService,
        path,
        valueObject,
        path,
      ),
    );
  }
}
