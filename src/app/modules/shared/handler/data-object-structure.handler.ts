import * as _ from 'lodash-es';
import { MultiComponent } from '../models/component/multi-component.model';
import { MultiInstanceObjectInfo } from '../models/info/multi-instance-object-info.model';
import { CedarComponent } from '../models/component/cedar-component.model';
import { SingleElementComponent } from '../models/element/single-element-component.model';
import { CedarTemplate } from '../models/template/cedar-template.model';
import { MultiElementComponent } from '../models/element/multi-element-component.model';
import { DataContext } from '../util/data-context';
import { MultiInstanceObjectHandler } from './multi-instance-object.handler';
import { OccurrenceSelector, OccurrenceSelectors } from './occurrence-selector';
import { DataObjectBuilderHandler } from './data-object-builder.handler';
import { InstanceDataContainer, InstanceDataEmptyNode } from 'cedar-model-typescript-library';
import { InstanceExtractData } from '../models/instance-extract-data.model';
import { TemplateComponent } from '../models/template/template-component.model';
import { MessageHandlerService } from '../service/message-handler.service';
import { InstanceArray, InstanceNode, isInstanceArray, isInstanceObject } from '../models/instance-node.model';

export class DataObjectStructureHandler {
  constructor(private readonly dataObjectBuilderService: DataObjectBuilderHandler = new DataObjectBuilderHandler()) {}

  /**
   * The node a component path points at, given a choice of occurrence at each
   * multi ancestor.
   *
   * `selectOccurrence` makes that choice. It used to be made here, by reading
   * each ancestor's `currentIndex` off the multi-instance service — so this
   * returned different nodes at different times with nothing in the signature
   * saying so, and every caller was silently order-dependent on a cursor
   * mutation. See `OccurrenceSelector`.
   */
  public getDataPathNodeRecursively(
    dataObject: InstanceExtractData,
    /*
     * Nullable, and deliberately so. None of the three `instanceof` branches below
     * matches a field, so a path that continues past one recurses with a null
     * component — which is how the walk says "the rest of this resolves to
     * nothing" and lets the `path.length === 0` case above answer. Guarding it
     * instead of admitting it is a real behaviour change: it emptied the external
     * authority field on selection, and five visual tests said so.
     */
    component: CedarComponent | null,
    path: string[],
    selectOccurrence: OccurrenceSelector,
    depth = 0,
  ): InstanceExtractData {
    if (path.length === 0) {
      return dataObject;
    } else {
      const firstPath = path[0];
      const remainingPath = path.slice(1);
      let childComponent: CedarComponent | null = null;
      let dataSubObject = null;
      if (component instanceof SingleElementComponent || component instanceof CedarTemplate) {
        childComponent = component.getChildByName(firstPath);
        if (isInstanceObject(dataObject)) {
          dataSubObject = dataObject.values[firstPath] ?? null;
        }
      } else if (component instanceof MultiElementComponent) {
        const occurrence = selectOccurrence(component);

        if (occurrence === null) {
          return null;
        }
        childComponent = component.getChildByName(firstPath);
        if (isInstanceArray(dataObject)) {
          const node = dataObject[occurrence];
          if (isInstanceObject(node)) {
            dataSubObject = node.values[firstPath] ?? null;
          }
        }
      }
      return this.getDataPathNodeRecursively(dataSubObject, childComponent, remainingPath, selectOccurrence, depth + 1);
    }
  }

  /**
   * The object *containing* the node a path points at, same rules.
   *
   * The attribute-value widget and the pager need this: an attribute's value
   * lives on the enclosing object under the attribute's own name, not under the
   * field's. It walks the same occurrences, so it takes the same selector — the
   * two had to change together or they would disagree about which occurrence a
   * path meant.
   */
  public getParentDataPathNodeRecursively(
    dataObject: InstanceExtractData,
    parentDataObject: InstanceExtractData,
    /** Nullable for the same reason as the walk above. */
    component: CedarComponent | null,
    path: string[],
    selectOccurrence: OccurrenceSelector,
  ): InstanceExtractData {
    if (path.length === 0) {
      return parentDataObject;
    } else {
      const firstPath = path[0];
      const remainingPath = path.slice(1);
      let childComponent: CedarComponent | null = null;
      let dataSubObject = null;
      let parentDataSubObject = null;

      if (component instanceof SingleElementComponent || component instanceof CedarTemplate) {
        childComponent = component.getChildByName(firstPath);
        if (isInstanceObject(dataObject)) {
          dataSubObject = dataObject.values[firstPath] ?? null;
        }
        parentDataSubObject = dataObject;
      } else if (component instanceof MultiElementComponent) {
        const occurrence = selectOccurrence(component);

        if (occurrence === null || occurrence < 0) {
          return null;
        }
        childComponent = component.getChildByName(firstPath);
        const node = isInstanceArray(dataObject) ? dataObject[occurrence] : null;
        if (isInstanceObject(node)) {
          dataSubObject = node.values[firstPath] ?? null;
        }
        parentDataSubObject = node;
      }
      return this.getParentDataPathNodeRecursively(
        dataSubObject,
        parentDataSubObject,
        childComponent,
        remainingPath,
        selectOccurrence,
      );
    }
  }

  multiInstanceItemAdd(
    dataContext: DataContext,
    component: MultiComponent,
    multiInstanceObjectService: MultiInstanceObjectHandler,
    messageHandlerService: MessageHandlerService,
  ): void {
    const multiInstanceInfo: MultiInstanceObjectInfo | null =
      multiInstanceObjectService.getMultiInstanceInfoForComponent(component);
    const templateRepresentation = dataContext.templateRepresentation;
    if (templateRepresentation === null || multiInstanceInfo === null) {
      return;
    }

    // The new occurrence is built with the envelope, because the instance is the
    // artifact and that is what an occurrence in one looks like. There used to be
    // a second, envelope-free copy of the whole instance to build it into as
    // well — see `DataContext.instanceExtractData`, now a derived view.
    dataContext.mutate((instance) =>
      this.performItemAdd(
        instance,
        templateRepresentation,
        component,
        multiInstanceObjectService,
        multiInstanceInfo,
        messageHandlerService,
      ),
    );
  }

  private performItemAdd(
    instanceObject: InstanceExtractData,
    templateRepresentation: TemplateComponent,
    component: MultiComponent,
    multiInstanceObjectService: MultiInstanceObjectHandler,
    multiInstanceInfo: MultiInstanceObjectInfo,
    messageHandlerService: MessageHandlerService,
  ): void {
    // Somewhere to build one occurrence, thrown away once it has been taken out
    // again. A bare `{}` while a container was a plain object.
    const dataObject = new InstanceDataContainer();
    const cloneComponent = _.cloneDeep(component);
    DataObjectBuilderHandler.setCurrentCountToMinRecursively(cloneComponent, component.path);
    // The property IRIs each new occurrence needs travel on the component, so
    // there is no sub-template to find first.
    this.dataObjectBuilderService.buildRecursively(cloneComponent, dataObject);
    const built = dataObject.values[component.name] ?? null;
    const newDataObject = isInstanceArray(built) ? built[0] : null;
    const currentNodeAny = this.getDataPathNodeRecursively(
      instanceObject,
      templateRepresentation,
      component.path,
      OccurrenceSelectors.fromCursor(multiInstanceObjectService),
    );
    // `isInstanceArray`, not truthiness. `currentNodeAny as []` asserted the shape
    // and the check that followed only asked whether it was present — so a node
    // holding a non-empty string passed the test and threw on `.splice`. The guard
    // asks the question the assertion was pretending to answer.
    const target = isInstanceArray(currentNodeAny)
      ? currentNodeAny
      : this.openListFor(instanceObject, templateRepresentation, component, multiInstanceObjectService, currentNodeAny);

    if (target !== null && newDataObject !== null) {
      target.splice(multiInstanceInfo.currentIndex + 1, 0, newDataObject);
    } else {
      messageHandlerService.error('missing data in instance:' + component.path);
    }
  }

  /**
   * Give a child the template declares a list to be added to.
   *
   * An instance need not carry a slot for every property its template declares, and
   * an attribute-value field naming no attribute is the case that reaches here: the
   * document omits the key, or carries the empty node a sparse instance is inflated
   * with. Either way the path resolves to nothing a new occurrence can go into, and
   * the add used to be refused — the button did nothing, and said so only in the
   * console. The template says the child is there, so the list it should already
   * have had is created rather than the addition being turned away.
   *
   * @returns the list now at that path, or null when the node holds data instead —
   *   which is a shape nobody should overwrite on the strength of an add.
   */
  private openListFor(
    instanceObject: InstanceExtractData,
    templateRepresentation: TemplateComponent,
    component: MultiComponent,
    multiInstanceObjectService: MultiInstanceObjectHandler,
    currentNode: InstanceExtractData,
  ): InstanceArray | null {
    if (currentNode !== null && currentNode !== undefined && !(currentNode instanceof InstanceDataEmptyNode)) {
      return null;
    }

    const parent = this.getParentDataPathNodeRecursively(
      instanceObject,
      null,
      templateRepresentation,
      component.path,
      OccurrenceSelectors.fromCursor(multiInstanceObjectService),
    );

    if (!isInstanceObject(parent)) {
      return null;
    }

    const list: InstanceArray = [];
    parent.setValue(component.name, list);
    return list;
  }

  multiInstanceItemCopy(
    dataContext: DataContext,
    component: MultiComponent,
    multiInstanceObjectService: MultiInstanceObjectHandler,
  ): void {
    const multiInstanceInfo: MultiInstanceObjectInfo | null =
      multiInstanceObjectService.getMultiInstanceInfoForComponent(component);
    const templateRepresentation = dataContext.templateRepresentation;
    if (templateRepresentation === null || multiInstanceInfo === null) {
      return;
    }
    dataContext.mutate((instance) =>
      this.performItemCopy(instance, templateRepresentation, component, multiInstanceObjectService, multiInstanceInfo),
    );
  }

  private performItemCopy(
    instanceObject: InstanceExtractData,
    templateRepresentation: TemplateComponent,
    component: MultiComponent,
    multiInstanceObjectService: MultiInstanceObjectHandler,
    multiInstanceInfo: MultiInstanceObjectInfo,
  ): void {
    const currentNodeAny = this.getDataPathNodeRecursively(
      instanceObject,
      templateRepresentation,
      component.path,
      OccurrenceSelectors.fromCursor(multiInstanceObjectService),
    );
    const currentNodeArray = currentNodeAny as [];
    const sourceItem = currentNodeArray[multiInstanceInfo.currentIndex];
    const cloneItem = _.cloneDeep(sourceItem);
    this.clearElementInstanceIds(cloneItem, component);
    currentNodeArray.splice(multiInstanceInfo.currentIndex + 1, 0, cloneItem as never);
  }

  multiInstanceItemDelete(
    dataContext: DataContext,
    component: MultiComponent,
    multiInstanceObjectService: MultiInstanceObjectHandler,
  ): void {
    const multiInstanceInfo: MultiInstanceObjectInfo | null =
      multiInstanceObjectService.getMultiInstanceInfoForComponent(component);
    const templateRepresentation = dataContext.templateRepresentation;
    if (templateRepresentation === null || multiInstanceInfo === null) {
      return;
    }
    dataContext.mutate((instance) =>
      this.performItemDelete(
        instance,
        templateRepresentation,
        component.path,
        multiInstanceObjectService,
        multiInstanceInfo,
      ),
    );
  }

  private performItemDelete(
    instanceObject: InstanceExtractData,
    templateRepresentation: TemplateComponent,
    path: string[],
    multiInstanceObjectService: MultiInstanceObjectHandler,
    multiInstanceInfo: MultiInstanceObjectInfo,
  ): void {
    const currentNodeAny = this.getDataPathNodeRecursively(
      instanceObject,
      templateRepresentation,
      path,
      OccurrenceSelectors.fromCursor(multiInstanceObjectService),
    );
    const currentNodeArray = currentNodeAny as [];
    currentNodeArray.splice(multiInstanceInfo.currentIndex, 1);
  }

  /**
   * Take every element occurrence's identity off a copied subtree.
   *
   * A duplicated occurrence is not the one it was copied from, and an identity a
   * repository assigned belongs to the original. Nothing is minted to put back:
   * the writer emits a null `@id` for a container that has none, which is what an
   * absent identity looks like, and which validates.
   *
   * The walk follows the component tree rather than the document, because an
   * `@id` cannot be recognised by its string value. A field may legitimately hold
   * an IRI under any namespace, so a prefix-based object walk silently rewrites
   * link and controlled-term values; only element components own an occurrence
   * envelope.
   */
  private clearElementInstanceIds(item: InstanceNode, component: CedarComponent): void {
    if (!(component instanceof SingleElementComponent || component instanceof MultiElementComponent)) {
      return;
    }
    // The hand-rolled shape test this replaces — `typeof item !== 'object' ||
    // Array.isArray(item)` — is exactly what the guard means, and the guard tells
    // the compiler as well as the reader.
    if (!isInstanceObject(item)) {
      return;
    }

    const occurrence = item;
    // `id` on the container, not a property written into it.
    occurrence.id = null;

    for (const childComponent of component.children) {
      const childValue = occurrence.values[childComponent.name] ?? null;
      if (childComponent instanceof SingleElementComponent) {
        this.clearElementInstanceIds(childValue, childComponent);
      } else if (childComponent instanceof MultiElementComponent && Array.isArray(childValue)) {
        for (const childOccurrence of childValue) {
          this.clearElementInstanceIds(childOccurrence, childComponent);
        }
      }
    }
  }
}
