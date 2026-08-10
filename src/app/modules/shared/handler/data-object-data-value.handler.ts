import { MultiInstanceObjectInfo } from '../models/info/multi-instance-object-info.model';
import { CedarComponent } from '../models/component/cedar-component.model';
import { SingleElementComponent } from '../models/element/single-element-component.model';
import { CedarTemplate } from '../models/template/cedar-template.model';
import { MultiElementComponent } from '../models/element/multi-element-component.model';
import { DataContext } from '../util/data-context';
import { MultiInstanceObjectHandler } from './multi-instance-object.handler';
import { SingleFieldComponent } from '../models/field/single-field-component.model';
import { InstanceDataAttributeValueFieldName, JsonSchema } from 'cedar-model-typescript-library';
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
  dataSubObject: InstanceNode | null;
  parentDataSubObject: InstanceNode | null;
  /**
   * The key that got from the parent to this child.
   *
   * Carried so the leaf can be written by *place* — parent plus key — rather
   * than by mutating the node the walk happened to arrive at. The two are the
   * same edit today, and only one of them survives the instance tree becoming
   * the model library's, whose atoms expose getters and no setters: a value is
   * replaced there, and replacing needs somewhere to put it.
   */
  key: string;
  /** Null when the path names a child the component does not have. */
  childComponent: CedarComponent | null;
  remainingPath: string[];
}

/**
 * One change to an attribute-value field: the attribute's name, and what it holds.
 *
 * A message, not a node. It travelled as a JSON fragment carrying two reserved
 * keys — `__reserved__attribute_name` and `__reserved__attribute_value` — which
 * every layer it passed through had to index and re-narrow, because the keys are
 * declared as `string` rather than as literals. A pair says the same thing and
 * the compiler can check it.
 */
interface AttributeWrite {
  /** Null when the slot has no name yet, which is how one starts. */
  name: string | null;
  value: InstanceNode;
}

/**
 * Whether this write names an attribute.
 *
 * The dispatch used to ask whether the JSON fragment carried a reserved key.
 * A guard over a declared shape asks the same question of a value that has one.
 */
const isAttributeWrite = (write: InstanceNode | AttributeWrite): write is AttributeWrite =>
  typeof write === 'object' && write !== null && !Array.isArray(write) && 'name' in write && 'value' in write;

export class DataObjectDataValueHandler {
  private messageHandlerService: MessageHandlerService;

  constructor(messageHandlerService: MessageHandlerService) {
    this.messageHandlerService = messageHandlerService;
  }

  /**
   * Put `valueObject` where `target` sits, rather than editing `target` itself.
   *
   * The distinction is the point. Writing to a *place* — a container and the key
   * under it — is the only form of write the model library's instance supports:
   * its atoms expose getters and no setters, so a value is replaced by calling
   * `setValue` on the parent, never mutated where it stands. Doing the same here
   * against the plain-object tree makes the two describe the same operation, so
   * the tree underneath can change without every caller changing with it.
   *
   * The node is still overwritten in place when the place cannot be reached — a
   * value at the root of the walk has no parent to be replaced within. That case
   * keeps the older behaviour rather than failing, and it is the one the model
   * cannot represent, so it is worth it being the one that stands out.
   */
  private placeValue(
    parent: InstanceExtractData,
    key: string | number,
    target: InstanceExtractData,
    valueObject: InstanceNode,
    fullPath: string[],
  ): void {
    if (target === null || target === undefined) {
      this.messageHandlerService.error('Unable to set missing data target:' + fullPath);
      return;
    }
    if (typeof key === 'number' && isInstanceArray(parent)) {
      parent[key] = valueObject;
      return;
    }
    if (typeof key === 'string' && key.length > 0 && isInstanceObject(parent)) {
      parent.setValue(key, valueObject);
      return;
    }
    /*
     * There used to be a third way: overwrite the node in place, reconciling the
     * five keys a value may carry, because the widgets hold references into the
     * tree and a node had to keep its identity. A value is an atom now — it has
     * no identity to keep and nothing to reconcile — so a value that has nowhere
     * to be put has genuinely nowhere to go, and saying so beats writing it
     * where nobody will look.
     */
    this.messageHandlerService.error('No place to put a value at: ' + fullPath.join(' > '));
  }

  private injectArrayValue(target: InstanceNode | null, valueArray: InstanceNode[]): void {
    if (!isInstanceArray(target)) {
      this.messageHandlerService.error('Expected a list of occurrences to replace, found something else');
      return;
    }
    target.length = 0;
    target.push(...valueArray);
  }

  /*
   * Narrower than `InstanceNode` on both, because this is the one place that
   * knows the shape: an attribute-value field keeps its *names* in an array and
   * the values they name on the parent container.
   */
  private injectAttributeValue(
    dataObject: InstanceArray,
    currentIndex: number,
    parentDataObject: InstanceObject,
    component: CedarComponent,
    write: AttributeWrite,
  ): void {
    const oldNameNode = dataObject[currentIndex];
    const oldName = oldNameNode instanceof InstanceDataAttributeValueFieldName ? oldNameNode.name : '';
    let newName = write.name ?? '';

    /*
     * An attribute row is created before its user-defined name exists. Keep that
     * row as an empty-name slot instead of manufacturing a real property such as
     * "Attribute Value Field1". The value control retains anything the user has
     * typed; once a name arrives the regular path below writes both halves.
     *
     * This also makes clearing a name honest: remove the old property and its
     * context entry rather than silently replacing it with another real name.
     */
    if (!newName) {
      dataObject[currentIndex] = new InstanceDataAttributeValueFieldName('');
      if (oldName) {
        // One call, and it takes the property IRI with it. Two `delete`s stood
        // here, on `values` and on the `@context` block, and forgetting the
        // second left an entry naming a property that was gone.
        parentDataObject.removeValue(oldName);
      }
      return;
    }

    if (this.isDuplicateAttributeName(newName, dataObject, parentDataObject, currentIndex)) {
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

    // The property IRI moves with the name, so an attribute keeps its identity
    // across a rename rather than being minted a new one.
    let propertyIri = needsDeleting ? parentDataObject.iris[oldName] ?? '' : '';
    if (needsDeleting) {
      parentDataObject.removeValue(oldName);
    }

    parentDataObject.setValue(newName, write.value);

    // The field's own name is not a property of the instance — only the
    // attributes it holds are — so it must not be left carrying an identity.
    parentDataObject.removeIri(component.name);

    if (!parentDataObject.hasIri(newName)) {
      if (propertyIri.length === 0) {
        propertyIri = CedarModel.propertyIriPrefix + DataObjectUtil.generateGUID();
      }
      parentDataObject.setIri(newName, propertyIri);
    }
  }

  private setDataPathValueRecursively(
    dataObject: InstanceNode | null,
    parentDataObject: InstanceNode | null,
    component: CedarComponent,
    multiInstanceObjectService: MultiInstanceObjectHandler,
    path: string[],
    valueObject: InstanceNode | AttributeWrite,
    fullPath: string[],
    /** Where `dataObject` sits in `parentDataObject`. Empty only at the root. */
    key = '',
  ): void {
    if (path.length === 0) {
      if (component instanceof SingleFieldComponent) {
        if (!isAttributeWrite(valueObject)) {
          this.placeValue(parentDataObject, key, dataObject, valueObject, fullPath);
        }
      } else {
        const multiField = component as MultiFieldComponent;
        const multiInstanceInfo: MultiInstanceObjectInfo | null =
          multiInstanceObjectService.getMultiInstanceInfoForComponent(multiField);
        const currentIndex = multiInstanceInfo?.currentIndex ?? 0;

        // Three shapes arrive here and the branch order is the discrimination: a
        // wrapper carrying a reserved attribute name, a list of occurrences, or a
        // single value wrapper destined for the current occurrence.
        if (!isAttributeWrite(valueObject) && isInstanceArray(valueObject)) {
          this.injectArrayValue(dataObject, valueObject);
        } else if (isAttributeWrite(valueObject)) {
          if (isInstanceArray(dataObject) && isInstanceObject(parentDataObject)) {
            this.injectAttributeValue(dataObject, currentIndex, parentDataObject, component, valueObject);
          }
        } else if (isInstanceArray(dataObject)) {
          this.placeValue(dataObject, currentIndex, dataObject[currentIndex] ?? null, valueObject, fullPath);
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
        downstream.key,
      );
    }
  }

  private deleteAttributeValueRecursively(
    dataObject: InstanceNode | null,
    parentDataObject: InstanceNode | null,
    component: CedarComponent,
    multiInstanceObjectService: MultiInstanceObjectHandler,
    path: string[],
    write: AttributeWrite,
  ): void {
    if (path.length === 0) {
      if (!isInstanceObject(parentDataObject)) {
        this.messageHandlerService.error('Expected a container to delete an attribute from, found something else');
        return;
      }
      if (write.name === null) {
        return;
      }
      parentDataObject.removeValue(write.name);
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
        write,
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
    let dataSubObject: InstanceNode | null = null;
    let parentDataSubObject: InstanceNode | null = null;

    // A single element and a template both hold their children directly; a multi
    // element holds a list of occurrences and the child sits inside the current one.
    if (component instanceof SingleElementComponent || component instanceof CedarTemplate) {
      childComponent = component.getChildByName(firstPath);
      if (isInstanceObject(dataObject)) {
        dataSubObject = dataObject.values[firstPath] ?? null;
      }
      parentDataSubObject = dataObject;
    } else if (component instanceof MultiElementComponent) {
      const multiInstanceInfo: MultiInstanceObjectInfo | null =
        multiInstanceObjectService.getMultiInstanceInfoForComponent(component);
      const currentIndex = multiInstanceInfo?.currentIndex ?? 0;
      childComponent = component.getChildByName(firstPath);
      const occurrence = isInstanceArray(dataObject) ? dataObject[currentIndex] : null;
      if (isInstanceObject(occurrence)) {
        dataSubObject = occurrence.values[firstPath] ?? null;
      }
      parentDataSubObject = occurrence;
    }

    return { dataSubObject, parentDataSubObject, key: firstPath, childComponent, remainingPath };
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
        : InstanceValueNode.iriValue(value)
      : InstanceValueNode.literalValue(value, DataObjectUtil.xsdTypeForFullCopy(component));
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
      valueArray.push(InstanceValueNode.literalValue(val));
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

    if (value && value.length === 0) {
      value = null;
    }

    const valueObject: AttributeWrite = { name: key, value: InstanceValueNode.literalValue(value) };

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
    // The value is not read on this path; only the name says which property goes.
    const valueObject: AttributeWrite = { name: key, value: InstanceValueNode.emptySlot(false) };

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
    const valueObject = atId ? InstanceValueNode.iriValue(atId, prefLabel) : {};

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
