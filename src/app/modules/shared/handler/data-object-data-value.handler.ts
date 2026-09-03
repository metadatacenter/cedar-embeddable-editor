import { MultiInstanceObjectInfo } from '../models/info/multi-instance-object-info.model';
import { CedarComponent } from '../models/component/cedar-component.model';
import { SingleElementComponent } from '../models/element/single-element-component.model';
import { CedarTemplate } from '../models/template/cedar-template.model';
import { MultiElementComponent } from '../models/element/multi-element-component.model';
import { DataContext } from '../util/data-context';
import { MultiInstanceObjectHandler } from './multi-instance-object.handler';
import { SingleFieldComponent } from '../models/field/single-field-component.model';
import { AttributeValueNamePolicy, InstanceDataAttributeValueFieldName } from 'cedar-model-typescript-library';
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
import { DataObjectUtil } from '../util/data-object-util';
import { valueIsIri } from '../models/ext-auth-categories.model';
import { InstanceValueNode } from '../util/instance-value-node';
import { MessageHandlerService } from '../service/message-handler.service';
import { InputType } from '../models/input-type.model';
import { StaticFieldComponent } from '../models/static/static-field-component.model';

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

/** Where an attribute name sits in the field's list of them, or -1. */
const indexOfName = (names: InstanceArray, name: string): number =>
  names.findIndex((n) => n instanceof InstanceDataAttributeValueFieldName && n.name === name);

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

  private injectArrayValue(target: InstanceNode | null, valueArray: InstanceNode[], fullPath: string[]): void {
    if (!isInstanceArray(target)) {
      /*
       * Named, because the message used to be "found something else" and nothing more.
       * A partial instance — one written by hand, naming some of a template's fields and
       * not the rest — brings the widget for every multi-valued field it left out to this
       * point, and the reader's next question is always which field. The path answers it.
       *
       * The path only. What was found there was reported for a while as well, and it said
       * "object" or "null" depending on how the key went missing, which distinguishes two
       * ways of writing the same mistake and helps with neither.
       */
      this.messageHandlerService.error(`Expected a list of occurrences to replace at ${fullPath.join(' > ')}`);
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
    declaredSiblingNames: ReadonlySet<string>,
  ): string | null {
    const oldNameNode = dataObject[currentIndex];
    const oldName = oldNameNode instanceof InstanceDataAttributeValueFieldName ? oldNameNode.name : '';
    const newName = write.name ?? '';

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
      const usedByAnotherSlot = this.isAttributeNameUsedElsewhere(dataObject, oldName, currentIndex);
      dataObject[currentIndex] = new InstanceDataAttributeValueFieldName('');
      if (oldName && !usedByAnotherSlot) {
        // One call, and it takes the property IRI with it. Two `delete`s stood
        // here, on `values` and on the `@context` block, and forgetting the
        // second left an entry naming a property that was gone.
        parentDataObject.removeValue(oldName);
      }
      return null;
    }

    if (AttributeValueNamePolicy.isReserved(newName)) {
      return `Attribute name "${newName}" is reserved for instance metadata.`;
    }

    if (
      declaredSiblingNames.has(newName) ||
      this.isDuplicateAttributeName(newName, dataObject, parentDataObject, currentIndex)
    ) {
      return `Attribute name "${newName}" is already used in this instance. Choose a unique name.`;
    }

    const usedByAnotherSlot = this.isAttributeNameUsedElsewhere(dataObject, oldName, currentIndex);
    dataObject[currentIndex] = new InstanceDataAttributeValueFieldName(newName);
    const needsDeleting = oldName && newName !== oldName && !usedByAnotherSlot;

    // The property IRI moves with the name, so an attribute keeps its identity
    // across a rename rather than being minted a new one.
    const propertyIri = needsDeleting ? parentDataObject.iris[oldName] ?? '' : '';
    if (needsDeleting) {
      parentDataObject.removeValue(oldName);
    }

    parentDataObject.setValue(newName, write.value);

    // The field's own name is not a property of the instance — only the
    // attributes it holds are — so it must not be left carrying an identity.
    parentDataObject.removeIri(component.name);

    /*
     * An attribute a user has just named carries no property IRI, and CEE does not
     * invent one.
     *
     * It minted `https://schema.metadatacenter.org/properties/<guid>` here, which
     * is an identity nothing assigned — the same fabrication the element-occurrence
     * `@id` was. The model library states the shape a draft takes: the attribute's
     * value sits at the instance root with no `@context` term, and the server fills
     * the term on upload. It dropped `PropertyIri.forId` to make that hard to get
     * wrong, which is what brought this to light.
     *
     * A rename still carries the old IRI across, above: that one was assigned, and
     * the attribute keeps its identity rather than being minted a new one.
     */
    if (!parentDataObject.hasIri(newName) && propertyIri.length > 0) {
      parentDataObject.setIri(newName, propertyIri);
    }
    return null;
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
    /** Serializable template children sharing the attribute's JSON object. */
    declaredSiblingNames: ReadonlySet<string> = new Set(),
  ): string | null {
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
          this.injectArrayValue(dataObject, valueObject, fullPath);
        } else if (isAttributeWrite(valueObject)) {
          if (isInstanceArray(dataObject) && isInstanceObject(parentDataObject)) {
            return this.injectAttributeValue(
              dataObject,
              currentIndex,
              parentDataObject,
              component,
              valueObject,
              declaredSiblingNames,
            );
          }
        } else if (isInstanceArray(dataObject)) {
          this.placeValue(dataObject, currentIndex, dataObject[currentIndex] ?? null, valueObject, fullPath);
        }
      }
    } else {
      const downstream = this.getDownstreamObjects(dataObject, component, multiInstanceObjectService, path);
      if (downstream.childComponent === null) {
        return null;
      }
      return this.setDataPathValueRecursively(
        downstream.dataSubObject,
        downstream.parentDataSubObject,
        downstream.childComponent,
        multiInstanceObjectService,
        downstream.remainingPath,
        valueObject,
        fullPath,
        downstream.key,
        declaredSiblingNames,
      );
    }
    return null;
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
    const ind = indexOfName(dataObject, name);

    // completely new name, check if parent object's names conflict
    if (ind < 0) {
      return parentDataObject.hasValue(name);
    }
    // name has not changed
    else if (ind === currentIndex) {
      return false;
    }
    // name changed but already exists in a different slot
    return true;
  }

  private isAttributeNameUsedElsewhere(dataObject: InstanceArray, name: string, currentIndex: number): boolean {
    return dataObject.some(
      (node, index) =>
        index !== currentIndex && node instanceof InstanceDataAttributeValueFieldName && node.name === name,
    );
  }

  /**
   * Template children reserve their JSON property names even when a sparse
   * instance currently omits them. Without this template-side check, an
   * attribute could claim the missing child's name and the later first edit of
   * that child would overwrite one of the two values.
   */
  private getDeclaredSiblingNames(component: FieldComponent, representation: CedarComponent): ReadonlySet<string> {
    let parent = representation;
    for (const segment of component.path.slice(0, -1)) {
      if (
        !(parent instanceof CedarTemplate) &&
        !(parent instanceof SingleElementComponent) &&
        !(parent instanceof MultiElementComponent)
      ) {
        return new Set();
      }
      const child = parent.getChildByName(segment);
      if (child === null) {
        return new Set();
      }
      parent = child;
    }

    if (
      !(parent instanceof CedarTemplate) &&
      !(parent instanceof SingleElementComponent) &&
      !(parent instanceof MultiElementComponent)
    ) {
      return new Set();
    }
    return new Set(
      parent.children.filter((child) => !(child instanceof StaticFieldComponent)).map((child) => child.name),
    );
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
        ? InstanceValueNode.emptySlot(true)
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
    const valueArray: InstanceNode[] = [];

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
  ): string | null {
    const path = component.path;

    if (value && value.length === 0) {
      value = null;
    }

    const valueObject: AttributeWrite = { name: key, value: InstanceValueNode.literalValue(value) };

    const representation = dataContext.templateRepresentation;
    if (representation === null) {
      return null;
    }
    const declaredSiblingNames = this.getDeclaredSiblingNames(component, representation);
    let validationError: string | null = null;
    dataContext.mutate((instance) => {
      validationError = this.setDataPathValueRecursively(
        instance,
        null,
        representation,
        multiInstanceObjectService,
        path,
        valueObject,
        path,
        '',
        declaredSiblingNames,
      );
    });
    return validationError;
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
    const valueObject = atId ? InstanceValueNode.iriValue(atId, prefLabel) : InstanceValueNode.emptySlot(true);

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
